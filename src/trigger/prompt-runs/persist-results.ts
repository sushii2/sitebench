import { AbortTaskRunError, logger, task } from "@trigger.dev/sdk"

import { getCitationDomain, getCitationRootDomain } from "@/lib/prompt-runs/analysis"
import { createInsforgeServiceClient } from "@/lib/insforge/service-client"
import { uploadRawResponseJson } from "@/lib/prompt-runs/raw-response-blob"
import type { BrandEntity } from "@/lib/brand-entities/types"
import type { PromptRun } from "@/lib/prompt-runs/types"
import type { PromptRunResponse } from "@/lib/prompt-run-responses/types"
import type { ResponseBrandMetric } from "@/lib/response-brand-metrics/types"
import type { ResponseCitation } from "@/lib/response-citations/types"
import { PROMPT_RUN_RESPONSE_PARSER_VERSION } from "@/src/trigger/prompt-runs/shared"
import type {
  AnalyzedRunPayload,
  AnalyzedProviderExecutionResult,
} from "@/src/trigger/prompt-runs/shared"

const SOURCE_DOMAINS_LOOKUP_CHUNK_SIZE = 50
const SOURCE_PAGES_LOOKUP_CHUNK_SIZE = 20
const SOURCE_PAGES_CHUNK_SIZE = 20
const PROMPT_RUN_RESPONSES_CHUNK_SIZE = 10

function takeRows<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

function chunk<T>(items: T[], size: number): T[][] {
  if (size <= 0) {
    return [items]
  }

  const chunks: T[][] = []

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }

  return chunks
}

function estimateBodyBytes(rows: unknown[]): number {
  return Buffer.byteLength(JSON.stringify(rows), "utf8")
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

  const existingByDomain = new Map<string, string>()
  const domainLookupChunks = chunk(domains, SOURCE_DOMAINS_LOOKUP_CHUNK_SIZE)

  for (const [index, batch] of domainLookupChunks.entries()) {
    logger.info("[prompt-runs] source_domains lookup chunk", {
      batchIndex: index,
      batchSize: batch.length,
      chunkCount: domainLookupChunks.length,
    })

    const existingResponse = await client.database
      .from("source_domains")
      .select("*")
      .in("domain", batch)

    if (!existingResponse || existingResponse.error) {
      throw existingResponse?.error ?? new Error("Unable to load source domains.")
    }

    for (const row of takeRows(
      existingResponse.data as Array<{ domain: string; id: string }>
    )) {
      existingByDomain.set(row.domain, row.id)
    }
  }

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

  const pagesByUrl = new Map<string, string>()
  const pageLookupChunks = chunk(urls, SOURCE_PAGES_LOOKUP_CHUNK_SIZE)

  for (const [index, batch] of pageLookupChunks.entries()) {
    logger.info("[prompt-runs] source_pages lookup chunk", {
      batchIndex: index,
      batchSize: batch.length,
      chunkCount: pageLookupChunks.length,
      estimatedQueryChars: batch.reduce(
        (total, url) => total + encodeURIComponent(url).length,
        0
      ),
    })

    const existingResponse = await client.database
      .from("source_pages")
      .select("*")
      .in("canonical_url", batch)

    if (!existingResponse || existingResponse.error) {
      throw existingResponse?.error ?? new Error("Unable to load source pages.")
    }

    for (const row of takeRows(
      existingResponse.data as Array<{ canonical_url: string; id: string }>
    )) {
      pagesByUrl.set(row.canonical_url, row.id)
    }
  }

  const missingUrls = urls.filter((url) => !pagesByUrl.has(url))

  if (missingUrls.length > 0) {
    const rows = missingUrls.map((url) => {
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

    const chunks = chunk(rows, SOURCE_PAGES_CHUNK_SIZE)

    for (const [index, batch] of chunks.entries()) {
      logger.info("[prompt-runs] source_pages insert chunk", {
        batchIndex: index,
        batchSize: batch.length,
        chunkCount: chunks.length,
        estimatedBodyBytes: estimateBodyBytes(batch),
        sampleUrl: batch[0]?.canonical_url ?? null,
      })

      const insertResponse = await client.database
        .from("source_pages")
        .insert(batch)
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
  }

  return pagesByUrl
}

async function uploadRawResponseJsonsToBlob(
  payload: AnalyzedRunPayload
): Promise<Map<string, string>> {
  const pending: Array<{
    key: string
    providerResult: AnalyzedProviderExecutionResult
    trackedPromptId: string
  }> = []

  for (const promptRun of payload.promptRuns) {
    for (const providerResult of promptRun.providerResults) {
      if (!providerResult.rawResponseJson) {
        continue
      }

      pending.push({
        key: `${promptRun.trackedPromptId}:${providerResult.providerId}`,
        providerResult,
        trackedPromptId: promptRun.trackedPromptId,
      })
    }
  }

  if (pending.length === 0) {
    return new Map()
  }

  const uploaded = await Promise.all(
    pending.map(async ({ key, providerResult, trackedPromptId }) => {
      const url = await uploadRawResponseJson({
        platformCode: providerResult.providerId,
        projectId: payload.projectId,
        rawResponseJson: providerResult.rawResponseJson ?? {},
        scheduledFor: payload.scheduledFor,
        trackedPromptId,
      })

      return [key, url] as const
    })
  )

  return new Map(uploaded)
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
      projectId: payload.projectId,
      promptRunCount: payload.promptRuns.length,
    })

    const client = createInsforgeServiceClient()
    const brands = await loadBrands(payload.projectId)
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
    const rawResponseJsonUrlByKey = await uploadRawResponseJsonsToBlob(payload)

    logger.info("[prompt-runs] Uploaded raw response JSON blobs", {
      uploadedCount: rawResponseJsonUrlByKey.size,
    })

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

    const promptRunResponseInsertRows = payload.promptRuns.flatMap((promptRun) =>
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
        raw_response_json: null,
        raw_response_json_url:
          rawResponseJsonUrlByKey.get(
            `${promptRun.trackedPromptId}:${response.providerId}`
          ) ?? null,
        raw_response_text: response.rawResponseText,
        responded_at: response.respondedAt,
        status: response.status,
      }))
    )

    const promptRunResponseChunks = chunk(
      promptRunResponseInsertRows,
      PROMPT_RUN_RESPONSES_CHUNK_SIZE
    )
    const promptRunResponses: PromptRunResponse[] = []

    for (const [index, batch] of promptRunResponseChunks.entries()) {
      logger.info("[prompt-runs] prompt_run_responses insert chunk", {
        batchIndex: index,
        batchSize: batch.length,
        chunkCount: promptRunResponseChunks.length,
        estimatedBodyBytes: estimateBodyBytes(batch),
      })

      const promptRunResponsesInsertResponse = await client.database
        .from("prompt_run_responses")
        .insert(batch)
        .select("*")

      if (!promptRunResponsesInsertResponse || promptRunResponsesInsertResponse.error) {
        throw (
          promptRunResponsesInsertResponse?.error ??
          new Error("Unable to insert prompt run responses.")
        )
      }

      for (const row of takeRows(
        promptRunResponsesInsertResponse.data as PromptRunResponse[] | PromptRunResponse | null
      )) {
        promptRunResponses.push(row)
      }
    }
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
      promptRunCount: promptRuns.length,
      responseCount: promptRunResponses.length,
    }
  },
})
