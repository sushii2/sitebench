import { AbortTaskRunError, logger, task } from "@trigger.dev/sdk"

import { getCitationDomain, getCitationRootDomain } from "@/lib/prompt-runs/analysis"
import { createInsforgeServiceClient } from "@/lib/insforge/service-client"
import { normalizeBrandNameKey, normalizeCompanyName, normalizeDescription, normalizeWebsite } from "@/lib/brands"
import type { BrandEntity } from "@/lib/brand-entities/types"
import type { PromptRun } from "@/lib/prompt-runs/types"
import type { PromptRunResponse } from "@/lib/prompt-run-responses/types"
import type { ResponseBrandMetric } from "@/lib/response-brand-metrics/types"
import type { ResponseCitation } from "@/lib/response-citations/types"
import { PROMPT_RUN_RESPONSE_PARSER_VERSION } from "@/src/trigger/prompt-runs/shared"
import type { AnalyzedRunPayload } from "@/src/trigger/prompt-runs/shared"

function takeRows<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

async function loadBrands(projectId: string) {
  const client = createInsforgeServiceClient()
  const response = await client.database
    .from("brand_entities")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load project brands.")
  }

  return takeRows(response.data as BrandEntity[] | BrandEntity | null)
}

async function ensureDiscoveredCompetitors(
  payload: AnalyzedRunPayload
): Promise<BrandEntity[]> {
  const client = createInsforgeServiceClient()
  const brands = await loadBrands(payload.projectId)
  let nextSortOrder =
    brands.reduce((maxSortOrder, brand) => Math.max(maxSortOrder, brand.sort_order), -1) +
    1

  for (const candidate of payload.discoveredCompetitors) {
    const normalizedName = normalizeBrandNameKey(candidate.name)
    const websiteUrl = normalizeWebsite(candidate.websiteUrl)
    const websiteHost = new URL(websiteUrl).hostname.replace(/^www\./i, "")
    const existing = brands.find(
      (brand) =>
        brand.normalized_name === normalizedName ||
        brand.website_host === websiteHost
    )

    if (existing) {
      continue
    }

    const response = await client.database
      .from("brand_entities")
      .insert([
        {
          created_by: "ai_discovered",
          description: normalizeDescription(candidate.description),
          is_active: true,
          name: normalizeCompanyName(candidate.name),
          normalized_name: normalizedName,
          project_id: payload.projectId,
          role: "competitor",
          sort_order: nextSortOrder,
          website_host: websiteHost,
          website_url: websiteUrl,
        },
      ])
      .select("*")
      .maybeSingle()

    if (!response || response.error || !response.data) {
      throw response?.error ?? new Error("Unable to insert discovered competitor.")
    }

    brands.push(response.data as BrandEntity)
    nextSortOrder += 1
  }

  return brands
}

async function ensureSourceDomains(urls: string[]) {
  const client = createInsforgeServiceClient()
  const domains = [
    ...new Set(
      urls
        .map((url) => getCitationDomain(url))
        .filter((domain): domain is string => Boolean(domain))
    ),
  ]

  if (domains.length === 0) {
    return new Map<string, string>()
  }

  const existingResponse = await client.database
    .from("source_domains")
    .select("*")
    .in("domain", domains)

  if (!existingResponse || existingResponse.error) {
    throw existingResponse?.error ?? new Error("Unable to load source domains.")
  }

  const existingDomains = takeRows(
    existingResponse.data as Array<{ domain: string; id: string }>
  )
  const existingByDomain = new Map(
    existingDomains.map((domain) => [domain.domain, domain.id])
  )
  const missingDomains = domains.filter((domain) => !existingByDomain.has(domain))

  if (missingDomains.length > 0) {
    const insertResponse = await client.database
      .from("source_domains")
      .insert(
        missingDomains.map((domain) => ({
          display_name: null,
          domain,
          root_domain: getCitationRootDomain(`https://${domain}`) ?? domain,
        }))
      )
      .select("*")

    if (!insertResponse || insertResponse.error) {
      throw insertResponse?.error ?? new Error("Unable to insert source domains.")
    }

    for (const row of takeRows(
      insertResponse.data as Array<{ domain: string; id: string }>
    )) {
      existingByDomain.set(row.domain, row.id)
    }
  }

  return existingByDomain
}

async function ensureSourcePages(urls: string[], domainIdsByDomain: Map<string, string>) {
  const client = createInsforgeServiceClient()

  if (urls.length === 0) {
    return new Map<string, string>()
  }

  const existingResponse = await client.database
    .from("source_pages")
    .select("*")
    .in("canonical_url", urls)

  if (!existingResponse || existingResponse.error) {
    throw existingResponse?.error ?? new Error("Unable to load source pages.")
  }

  const existingPages = takeRows(
    existingResponse.data as Array<{ canonical_url: string; id: string }>
  )
  const pagesByUrl = new Map(
    existingPages.map((page) => [page.canonical_url, page.id])
  )
  const missingUrls = urls.filter((url) => !pagesByUrl.has(url))

  if (missingUrls.length > 0) {
    const insertResponse = await client.database
      .from("source_pages")
      .insert(
        missingUrls.map((url) => {
          const domain = getCitationDomain(url)

          if (!domain) {
            throw new AbortTaskRunError(`Unable to derive citation domain for ${url}.`)
          }

          return {
            canonical_url: url,
            domain_id: domainIdsByDomain.get(domain),
            page_title: null,
          }
        })
      )
      .select("*")

    if (!insertResponse || insertResponse.error) {
      throw insertResponse?.error ?? new Error("Unable to insert source pages.")
    }

    for (const row of takeRows(
      insertResponse.data as Array<{ canonical_url: string; id: string }>
    )) {
      pagesByUrl.set(row.canonical_url, row.id)
    }
  }

  return pagesByUrl
}

export const persistResults = task({
  id: "prompt-runs.persist-results",
  maxDuration: 300,
  queue: {
    concurrencyLimit: 10,
    name: "prompt-runs-persist",
  },
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: AnalyzedRunPayload) => {
    logger.info("[prompt-runs] Persist started", {
      discoveredCompetitorCount: payload.discoveredCompetitors.length,
      projectId: payload.projectId,
      promptRunCount: payload.promptRuns.length,
    })

    const client = createInsforgeServiceClient()
    const brands = await ensureDiscoveredCompetitors(payload)
    const brandById = new Map(brands.map((brand) => [brand.id, brand]))
    const promptRunResponseRows = payload.promptRuns.flatMap((promptRun) =>
      promptRun.providerResults
    )
    const citationUrls = [
      ...new Set(
        promptRunResponseRows.flatMap((response) =>
          response.citations.map((citation) => citation.url)
        )
      ),
    ]
    const domainIdsByDomain = await ensureSourceDomains(citationUrls)
    const pageIdsByUrl = await ensureSourcePages(citationUrls, domainIdsByDomain)

    const promptRunsInsertResponse = await client.database
      .from("prompt_runs")
      .insert(
        payload.promptRuns.map((promptRun) => ({
          cadence_applied: payload.cadenceApplied,
          completed_at: payload.completedAt,
          failure_reason: promptRun.failureReason,
          project_id: payload.projectId,
          project_topic_id: promptRun.projectTopicId,
          scheduled_for: payload.scheduledFor,
          started_at: payload.startedAt,
          status: promptRun.status,
          tracked_prompt_id: promptRun.trackedPromptId,
          trigger_type: payload.triggerType,
        }))
      )
      .select("*")

    if (!promptRunsInsertResponse || promptRunsInsertResponse.error) {
      throw promptRunsInsertResponse?.error ?? new Error("Unable to insert prompt runs.")
    }

    const promptRuns = takeRows(
      promptRunsInsertResponse.data as PromptRun[] | PromptRun | null
    )
    const promptRunIdByTrackedPromptId = new Map(
      promptRuns.map((promptRun) => [promptRun.tracked_prompt_id, promptRun.id])
    )

    const promptRunResponsesInsertResponse = await client.database
      .from("prompt_run_responses")
      .insert(
        payload.promptRuns.flatMap((promptRun) =>
          promptRun.providerResults.map((response) => ({
            error_code: response.errorCode,
            error_message: response.errorMessage,
            input_tokens: response.inputTokens,
            latency_ms: response.latencyMs,
            output_tokens: response.outputTokens,
            parser_version: PROMPT_RUN_RESPONSE_PARSER_VERSION,
            platform_code: response.providerId,
            project_id: payload.projectId,
            prompt_run_id: promptRunIdByTrackedPromptId.get(promptRun.trackedPromptId),
            prompt_text: response.promptText,
            provider_model: response.providerModel,
            raw_response_json: response.rawResponseJson,
            raw_response_text: response.rawResponseText,
            responded_at: response.respondedAt,
            status: response.status,
          }))
        )
      )
      .select("*")

    if (!promptRunResponsesInsertResponse || promptRunResponsesInsertResponse.error) {
      throw (
        promptRunResponsesInsertResponse?.error ??
        new Error("Unable to insert prompt run responses.")
      )
    }

    const promptRunResponses = takeRows(
      promptRunResponsesInsertResponse.data as PromptRunResponse[] | PromptRunResponse | null
    )
    const responseIdByProviderKey = new Map(
      promptRunResponses.map((response) => {
        const promptRun = promptRuns.find(
          (run) => run.id === response.prompt_run_id
        )

        return [
          `${promptRun?.tracked_prompt_id}:${response.platform_code}`,
          response.id,
        ] as const
      })
    )

    const responseBrandMetricsInsertResponse = await client.database
      .from("response_brand_metrics")
      .insert(
        payload.promptRuns.flatMap((promptRun) =>
          promptRun.providerResults.flatMap((response) =>
            response.brandMetrics
              .filter((metric) => brandById.has(metric.brandEntityId))
              .map((metric) => ({
                brand_entity_id: metric.brandEntityId,
                citation_score: metric.citationScore,
                mention_count: metric.mentionCount,
                project_id: payload.projectId,
                rank_position: metric.rankPosition,
                recommendation_status: metric.recommendationStatus,
                response_id: responseIdByProviderKey.get(
                  `${promptRun.trackedPromptId}:${response.providerId}`
                ),
                sentiment_label: metric.sentimentLabel,
                sentiment_score: metric.sentimentScore,
                visibility_score: metric.visibilityScore,
              }))
          )
        )
      )
      .select("*")

    if (
      !responseBrandMetricsInsertResponse ||
      responseBrandMetricsInsertResponse.error
    ) {
      throw (
        responseBrandMetricsInsertResponse?.error ??
        new Error("Unable to insert response brand metrics.")
      )
    }

    const responseBrandMetrics = takeRows(
      responseBrandMetricsInsertResponse.data as
        | ResponseBrandMetric[]
        | ResponseBrandMetric
        | null
    )
    const responseBrandMetricIdByKey = new Map(
      responseBrandMetrics.map((metric) => [
        `${metric.response_id}:${metric.brand_entity_id}`,
        metric.id,
      ])
    )

    const responseCitationsInsertResponse = await client.database
      .from("response_citations")
      .insert(
        payload.promptRuns.flatMap((promptRun) =>
          promptRun.providerResults.flatMap((response) =>
            response.citations.map((citation) => ({
              authority_score: null,
              citation_order: citation.citationOrder,
              citation_text: citation.text,
              cited_url: citation.url,
              project_id: payload.projectId,
              response_id: responseIdByProviderKey.get(
                `${promptRun.trackedPromptId}:${response.providerId}`
              ),
              source_page_id: pageIdsByUrl.get(citation.url),
            }))
          )
        )
      )
      .select("*")

    if (!responseCitationsInsertResponse || responseCitationsInsertResponse.error) {
      throw (
        responseCitationsInsertResponse?.error ??
        new Error("Unable to insert response citations.")
      )
    }

    const responseCitations = takeRows(
      responseCitationsInsertResponse.data as ResponseCitation[] | ResponseCitation | null
    )
    const responseCitationIdByKey = new Map(
      responseCitations.map((citation) => [
        `${citation.response_id}:${citation.cited_url}`,
        citation.id,
      ])
    )

    const responseBrandCitationsPayload = payload.promptRuns.flatMap((promptRun) =>
      promptRun.providerResults.flatMap((response) =>
        response.brandMetrics.flatMap((metric) => {
          const responseId = responseIdByProviderKey.get(
            `${promptRun.trackedPromptId}:${response.providerId}`
          )
          const responseBrandMetricId =
            responseId &&
            responseBrandMetricIdByKey.get(`${responseId}:${metric.brandEntityId}`)

          if (!responseId || !responseBrandMetricId) {
            return []
          }

          return metric.citationUrls
            .map((citationUrl) => ({
              attribution_score: 1,
              project_id: payload.projectId,
              response_brand_metric_id: responseBrandMetricId,
              response_citation_id: responseCitationIdByKey.get(
                `${responseId}:${citationUrl}`
              ),
            }))
            .filter(
              (
                candidate
              ): candidate is {
                attribution_score: number
                project_id: string
                response_brand_metric_id: string
                response_citation_id: string
              } => Boolean(candidate.response_citation_id)
            )
        })
      )
    )

    if (responseBrandCitationsPayload.length > 0) {
      const responseBrandCitationsInsertResponse = await client.database
        .from("response_brand_citations")
        .insert(responseBrandCitationsPayload)
        .select("*")

      if (
        !responseBrandCitationsInsertResponse ||
        responseBrandCitationsInsertResponse.error
      ) {
        throw (
          responseBrandCitationsInsertResponse?.error ??
          new Error("Unable to insert response brand citations.")
        )
      }
    }

    logger.info("[prompt-runs] Persist completed", {
      projectId: payload.projectId,
      promptRunCount: promptRuns.length,
      responseCount: promptRunResponses.length,
    })

    return {
      discoveredCompetitorCount: payload.discoveredCompetitors.length,
      promptRunCount: promptRuns.length,
      responseCount: promptRunResponses.length,
    }
  },
})
