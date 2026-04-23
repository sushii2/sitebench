import type { InsForgeClient } from "@insforge/sdk"

import type { AiPlatform } from "@/lib/ai-platforms/types"
import type { BrandEntity } from "@/lib/brand-entities/types"
import type { ChatFilters, ChatTimeframe } from "@/lib/chats/filters"
import { groupSources } from "@/lib/chats/source-grouping"
import type {
  ChatBrandMention,
  ChatBrandMentionSummary,
  ChatDetail,
  ChatPlatformSummary,
  ChatResponseView,
  ChatSentimentSummary,
  ChatSummary,
  PipelineRunBatch,
} from "@/lib/chats/types"
import type { ProjectTopic } from "@/lib/project-topics/types"
import type { PromptRun, PromptRunStatus } from "@/lib/prompt-runs/types"
import type { PromptRunResponse, PromptRunResponseStatus } from "@/lib/prompt-run-responses/types"
import type { ResponseBrandMetric } from "@/lib/response-brand-metrics/types"
import type { ResponseCitation } from "@/lib/response-citations/types"
import type { SourceDomain } from "@/lib/source-domains/types"
import type { SourcePage } from "@/lib/source-pages/types"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

type RawBrandEntity = {
  id: string
  name: string
  role: "primary" | "competitor"
  website_host?: string | null
}

type RawBrandMetric = {
  brand_entity_id: string
  brand_entities: RawBrandEntity | null
}

type RawCitation = {
  id: string
  cited_url?: string | null
  source_page_id?: string | null
}

type RawResponse = {
  id: string
  platform_code: string
  status: PromptRunResponseStatus
  response_brand_metrics: RawBrandMetric[] | null
  response_citations: RawCitation[] | null
}

type RawRun = {
  id: string
  project_id: string
  project_topic_id: string
  tracked_prompt_id: string
  scheduled_for: string
  completed_at: string | null
  status: PromptRunStatus
  project_topics: { id: string; name: string } | null
  tracked_prompts: { id: string; prompt_text: string } | null
  prompt_run_responses: RawResponse[] | null
}

function toDay(iso: string): string {
  return iso.slice(0, 10)
}

function buildPlatforms(
  responses: RawResponse[],
  platforms: AiPlatform[]
): ChatPlatformSummary[] {
  const byCode = new Map<string, RawResponse>()

  for (const response of responses) {
    byCode.set(response.platform_code, response)
  }

  return [...platforms]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((platform) => {
      const response = byCode.get(platform.code)

      return {
        code: platform.code,
        label: platform.label,
        responseId: response?.id ?? null,
        status: response?.status ?? "missing",
      }
    })
}

function collectBrandMentions(
  responses: RawResponse[]
): ChatBrandMentionSummary[] {
  const seen = new Map<string, ChatBrandMentionSummary>()

  for (const response of responses) {
    for (const metric of response.response_brand_metrics ?? []) {
      if (!metric.brand_entities || seen.has(metric.brand_entity_id)) {
        continue
      }

      seen.set(metric.brand_entity_id, {
        brandEntityId: metric.brand_entity_id,
        name: metric.brand_entities.name,
        role: metric.brand_entities.role,
        websiteHost: metric.brand_entities.website_host ?? null,
      })
    }
  }

  return [...seen.values()]
}

function countSources(responses: RawResponse[]): number {
  const seen = new Set<string>()

  for (const response of responses) {
    for (const citation of response.response_citations ?? []) {
      seen.add(citation.source_page_id ?? citation.cited_url ?? citation.id)
    }
  }

  return seen.size
}

function toSentimentValue(
  score: number | null,
  label: ResponseBrandMetric["sentiment_label"]
): number {
  if (score !== null) {
    if (score >= -1 && score <= 1) {
      return score
    }

    return Math.max(-1, Math.min(1, score / 100))
  }

  if (label === "positive") return 0.75
  if (label === "negative") return -0.75
  return 0
}

function summarizeChatSentiment(
  brands: ChatBrandMention[]
): ChatSentimentSummary | null {
  const primaryMentions = brands.filter((mention) => mention.brand.role === "primary")

  if (primaryMentions.length === 0) {
    return null
  }

  const values = primaryMentions.map((mention) =>
    toSentimentValue(
      mention.metric.sentiment_score,
      mention.metric.sentiment_label
    )
  )
  const average = values.reduce((sum, value) => sum + value, 0) / values.length
  const hasPositive = values.some((value) => value >= 0.25)
  const hasNegative = values.some((value) => value <= -0.25)
  const label =
    hasPositive && hasNegative ? "mixed" :
    average >= 0.25 ? "positive" :
    average <= -0.25 ? "negative" :
    "neutral"

  return {
    label,
    sampleSize: primaryMentions.length,
    score: Number(average.toFixed(3)),
  }
}

export function mapChatSummaryRows(
  rows: RawRun[],
  platforms: AiPlatform[]
): ChatSummary[] {
  return rows.map((row) => {
    const responses = row.prompt_run_responses ?? []

    return {
      brandMentions: collectBrandMentions(responses),
      completedAt: row.completed_at,
      platforms: buildPlatforms(responses, platforms),
      promptRunId: row.id,
      promptText: row.tracked_prompts?.prompt_text ?? "",
      projectTopicId: row.project_topic_id,
      scheduledFor: row.scheduled_for,
      sourceCount: countSources(responses),
      status: row.status,
      topicName: row.project_topics?.name ?? "",
      trackedPromptId: row.tracked_prompt_id,
    }
  })
}

export function mapPipelineRunBatchRows(
  rows: Array<{ scheduled_for: string }>
): PipelineRunBatch[] {
  const counts = new Map<string, number>()

  for (const row of rows) {
    const date = toDay(row.scheduled_for)

    counts.set(date, (counts.get(date) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, count]) => ({ count, date }))
}

type ChatsClient = Pick<InsForgeClient, "database">

const DAY_MS = 24 * 60 * 60 * 1000

const TIMEFRAME_DAYS: Record<ChatTimeframe, number> = {
  "90d": 90,
  "30d": 30,
  "7d": 7,
  custom: 0,
  today: 1,
}

function buildScheduledRange(
  filters: ChatFilters,
  now: number
): { gte: string | null; lt: string | null } {
  if (filters.pipelineRunDate) {
    const start = new Date(`${filters.pipelineRunDate}T00:00:00.000Z`)
    const end = new Date(start.getTime() + DAY_MS)

    return { gte: start.toISOString(), lt: end.toISOString() }
  }

  if (!filters.timeframe) {
    return { gte: null, lt: null }
  }

  if (filters.timeframe === "custom" && filters.customRange) {
    return {
      gte: new Date(`${filters.customRange.from}T00:00:00.000Z`).toISOString(),
      lt: new Date(
        new Date(`${filters.customRange.to}T00:00:00.000Z`).getTime() + DAY_MS
      ).toISOString(),
    }
  }

  const days = TIMEFRAME_DAYS[filters.timeframe]

  if (!days) {
    return { gte: null, lt: null }
  }

  return {
    gte: new Date(now - days * DAY_MS).toISOString(),
    lt: null,
  }
}

function takeRows<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

const SUMMARY_SELECT = `*,
  project_topics(id,name),
  tracked_prompts(id,prompt_text),
  prompt_run_responses(
    id, platform_code, status,
    response_brand_metrics(
      brand_entity_id,
      brand_entities(id, name, role, website_host)
    ),
    response_citations(id, cited_url, source_page_id)
  )`

export async function listChatRuns(
  client: ChatsClient,
  input: {
    projectId: string
    filters: ChatFilters
    now?: number
  }
): Promise<RawRun[]> {
  const now = input.now ?? Date.now()
  const range = buildScheduledRange(input.filters, now)

  let query = client.database
    .from("prompt_runs")
    .select(SUMMARY_SELECT)
    .eq("project_id", input.projectId)

  if (range.gte) {
    query = query.gte("scheduled_for", range.gte)
  }

  if (range.lt) {
    query = query.lt("scheduled_for", range.lt)
  }

  if (input.filters.topicIds.length > 0) {
    query = query.in("project_topic_id", input.filters.topicIds)
  }

  if (input.filters.trackedPromptIds.length > 0) {
    query = query.in("tracked_prompt_id", input.filters.trackedPromptIds)
  }

  const response = await query.order("scheduled_for", { ascending: false })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load chats.")
  }

  return takeRows(response.data as RawRun[] | RawRun | null)
}

export async function listPipelineRunBatches(
  client: ChatsClient,
  projectId: string
): Promise<PipelineRunBatch[]> {
  const response = await client.database
    .from("prompt_runs")
    .select("scheduled_for")
    .eq("project_id", projectId)
    .order("scheduled_for", { ascending: false })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load pipeline run batches.")
  }

  const rows = takeRows(
    response.data as Array<{ scheduled_for: string }> | null
  )

  return mapPipelineRunBatchRows(rows)
}

export async function listProjectSourceDomains(
  client: ChatsClient,
  projectId: string
): Promise<SourceDomain[]> {
  const response = await client.database
    .from("response_citations")
    .select("source_pages(source_domains(*))")
    .eq("project_id", projectId)

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load source domains.")
  }

  type RawNested = {
    source_pages:
      | { source_domains: SourceDomain | SourceDomain[] | null }
      | Array<{ source_domains: SourceDomain | SourceDomain[] | null }>
      | null
  }

  const rows = takeRows(
    response.data as unknown as RawNested | RawNested[] | null
  )

  function firstOf<T>(value: T | T[] | null): T | null {
    if (Array.isArray(value)) {
      return value[0] ?? null
    }

    return value
  }

  const seen = new Map<string, SourceDomain>()

  for (const row of rows) {
    const page = firstOf(row.source_pages)
    const domain = page ? firstOf(page.source_domains) : null

    if (domain && !seen.has(domain.id)) {
      seen.set(domain.id, domain)
    }
  }

  return [...seen.values()].sort((a, b) => a.domain.localeCompare(b.domain))
}

type MaybeOne<T> = T | T[] | null | undefined

type DetailRawResponse = PromptRunResponse & {
  response_brand_metrics:
    | Array<
        ResponseBrandMetric & {
          brand_entities: MaybeOne<BrandEntity>
        }
      >
    | null
}

type DetailRawRun = PromptRun & {
  project_topics: MaybeOne<ProjectTopic>
  tracked_prompts: MaybeOne<TrackedPrompt>
  prompt_run_responses: DetailRawResponse[] | null
}

function firstOf<T>(value: MaybeOne<T>): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

const DETAIL_SELECT = `*,
  project_topics(*),
  tracked_prompts(*),
  prompt_run_responses(
    *,
    response_brand_metrics(
      *,
      brand_entities(*)
    )
  )`

export async function getChatDetailRaw(
  client: ChatsClient,
  input: { projectId: string; promptRunId: string }
): Promise<DetailRawRun | null> {
  const response = await client.database
    .from("prompt_runs")
    .select(DETAIL_SELECT)
    .eq("project_id", input.projectId)
    .eq("id", input.promptRunId)
    .maybeSingle()

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load chat detail.")
  }

  return (response.data as DetailRawRun | null) ?? null
}

export type LoadedCitation = {
  attributedBrandIds: string[]
  citation: ResponseCitation
  page: SourcePage
  domain: SourceDomain
}

export async function loadCitationsForResponses(
  client: ChatsClient,
  responseIds: string[]
): Promise<Map<string, LoadedCitation[]>> {
  const byResponseId = new Map<string, LoadedCitation[]>()

  if (responseIds.length === 0) {
    return byResponseId
  }

  const citationsResponse = await client.database
    .from("response_citations")
    .select("*")
    .in("response_id", responseIds)
    .order("citation_order", { ascending: true })

  if (!citationsResponse || citationsResponse.error) {
    throw (
      citationsResponse?.error ??
      new Error("Unable to load response citations.")
    )
  }

  const citations = takeRows(
    citationsResponse.data as ResponseCitation[] | ResponseCitation | null
  )

  if (citations.length === 0) {
    return byResponseId
  }

  const citationIds = citations.map((citation) => citation.id)
  const attributedBrandIdsByCitationId = new Map<string, string[]>()

  if (citationIds.length > 0) {
    const attributionsResponse = await client.database
      .from("response_brand_citations")
      .select("response_citation_id,response_brand_metrics(brand_entity_id)")
      .in("response_citation_id", citationIds)

    if (!attributionsResponse || attributionsResponse.error) {
      throw (
        attributionsResponse?.error ??
        new Error("Unable to load response brand citations.")
      )
    }

    type RawAttributionRow = {
      response_citation_id: string
      response_brand_metrics:
        | { brand_entity_id: string }
        | Array<{ brand_entity_id: string }>
        | null
    }

    for (const row of takeRows(
      attributionsResponse.data as RawAttributionRow | RawAttributionRow[] | null
    )) {
      const metric = firstOf(row.response_brand_metrics)

      if (!metric) {
        continue
      }

      const list = attributedBrandIdsByCitationId.get(row.response_citation_id) ?? []

      if (!list.includes(metric.brand_entity_id)) {
        list.push(metric.brand_entity_id)
      }

      attributedBrandIdsByCitationId.set(row.response_citation_id, list)
    }
  }

  const pageIds = [
    ...new Set(
      citations
        .map((citation) => citation.source_page_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const pagesById = new Map<string, SourcePage>()

  if (pageIds.length > 0) {
    const pagesResponse = await client.database
      .from("source_pages")
      .select("*")
      .in("id", pageIds)

    if (!pagesResponse || pagesResponse.error) {
      throw pagesResponse?.error ?? new Error("Unable to load source pages.")
    }

    for (const page of takeRows(
      pagesResponse.data as SourcePage[] | SourcePage | null
    )) {
      pagesById.set(page.id, page)
    }
  }

  const domainIds = [
    ...new Set(
      [...pagesById.values()]
        .map((page) => page.domain_id)
        .filter((id): id is string => Boolean(id))
    ),
  ]

  const domainsById = new Map<string, SourceDomain>()

  if (domainIds.length > 0) {
    const domainsResponse = await client.database
      .from("source_domains")
      .select("*")
      .in("id", domainIds)

    if (!domainsResponse || domainsResponse.error) {
      throw (
        domainsResponse?.error ?? new Error("Unable to load source domains.")
      )
    }

    for (const domain of takeRows(
      domainsResponse.data as SourceDomain[] | SourceDomain | null
    )) {
      domainsById.set(domain.id, domain)
    }
  }

  for (const citation of citations) {
    const page = citation.source_page_id
      ? pagesById.get(citation.source_page_id) ?? null
      : null

    if (!page) {
      continue
    }

    const domain = page.domain_id
      ? domainsById.get(page.domain_id) ?? null
      : null

    if (!domain) {
      continue
    }

    const list = byResponseId.get(citation.response_id) ?? []

    list.push({
      attributedBrandIds: attributedBrandIdsByCitationId.get(citation.id) ?? [],
      citation,
      domain,
      page,
    })
    byResponseId.set(citation.response_id, list)
  }

  return byResponseId
}

export function buildChatDetail(
  raw: DetailRawRun,
  brands: BrandEntity[],
  platforms: AiPlatform[],
  citationsByResponseId: Map<string, LoadedCitation[]> = new Map()
): ChatDetail | null {
  const topic = firstOf(raw.project_topics)
  const trackedPrompt = firstOf(raw.tracked_prompts)

  if (!topic || !trackedPrompt) {
    return null
  }

  const platformByCode = new Map(platforms.map((p) => [p.code, p]))
  const responses = raw.prompt_run_responses ?? []

  const views: ChatResponseView[] = responses
    .slice()
    .sort((a, b) => {
      const ao = platformByCode.get(a.platform_code)?.sort_order ?? 999
      const bo = platformByCode.get(b.platform_code)?.sort_order ?? 999

      return ao - bo
    })
    .map((response) => {
      const brandMentions: ChatBrandMention[] = []

      for (const metric of response.response_brand_metrics ?? []) {
        const brand = firstOf(metric.brand_entities)

        if (!brand) {
          continue
        }

        brandMentions.push({ brand, metric })
      }

      const rawSources = citationsByResponseId.get(response.id) ?? []
      const platform = platformByCode.get(response.platform_code) ?? null

      return {
        brands: brandMentions,
        platform,
        platformLabel: platform?.label ?? response.platform_code,
        response,
        sources: groupSources(rawSources, brands),
      }
    })
  const chatSentiment = summarizeChatSentiment(
    views.flatMap((view) => view.brands)
  )

  return {
    chatSentiment,
    promptRun: raw,
    responses: views,
    topic,
    trackedPrompt,
  }
}

export async function listChats(
  client: ChatsClient,
  input: {
    projectId: string
    filters: ChatFilters
    platforms: AiPlatform[]
    now?: number
  }
): Promise<ChatSummary[]> {
  const rawRuns = await listChatRuns(client, {
    filters: input.filters,
    now: input.now,
    projectId: input.projectId,
  })

  const summaries = mapChatSummaryRows(rawRuns, input.platforms)

  const brandSet = new Set(input.filters.brandEntityIds)

  const filteredByBrand =
    brandSet.size === 0
      ? summaries
      : summaries.filter((summary) =>
          summary.brandMentions.some((mention) =>
            brandSet.has(mention.brandEntityId)
          )
        )

  if (input.filters.sourceDomainIds.length === 0) {
    return filteredByBrand
  }

  const sourceSet = new Set(input.filters.sourceDomainIds)
  const runIdsWithMatchingSource = await loadRunIdsWithSourceDomains(
    client,
    input.projectId,
    sourceSet
  )

  return filteredByBrand.filter((summary) =>
    runIdsWithMatchingSource.has(summary.promptRunId)
  )
}

async function loadRunIdsWithSourceDomains(
  client: ChatsClient,
  projectId: string,
  sourceDomainIds: Set<string>
): Promise<Set<string>> {
  if (sourceDomainIds.size === 0) {
    return new Set()
  }

  const response = await client.database
    .from("response_citations")
    .select(
      "prompt_run_responses(prompt_run_id),source_pages(domain_id)"
    )
    .eq("project_id", projectId)
    .in("source_pages.domain_id", [...sourceDomainIds])

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to filter by source domain.")
  }

  type RawJoinRow = {
    prompt_run_responses:
      | { prompt_run_id: string }
      | Array<{ prompt_run_id: string }>
      | null
    source_pages:
      | { domain_id: string }
      | Array<{ domain_id: string }>
      | null
  }

  const rows = takeRows(response.data as RawJoinRow | RawJoinRow[] | null)

  const matches = new Set<string>()

  function firstOf<T>(value: T | T[] | null): T | null {
    if (Array.isArray(value)) {
      return value[0] ?? null
    }

    return value
  }

  for (const row of rows) {
    const page = firstOf(row.source_pages)
    const response = firstOf(row.prompt_run_responses)

    if (page && sourceDomainIds.has(page.domain_id) && response) {
      matches.add(response.prompt_run_id)
    }
  }

  return matches
}

export async function getChatDetail(
  client: ChatsClient,
  input: {
    projectId: string
    promptRunId: string
    brands: BrandEntity[]
    platforms: AiPlatform[]
  }
): Promise<ChatDetail | null> {
  const raw = await getChatDetailRaw(client, {
    projectId: input.projectId,
    promptRunId: input.promptRunId,
  })

  if (!raw) {
    return null
  }

  const responseIds = (raw.prompt_run_responses ?? []).map(
    (response) => response.id
  )
  const citationsByResponseId = await loadCitationsForResponses(
    client,
    responseIds
  )

  return buildChatDetail(
    raw,
    input.brands,
    input.platforms,
    citationsByResponseId
  )
}
