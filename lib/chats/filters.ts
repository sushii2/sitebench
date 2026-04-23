import type { ChatSummary } from "@/lib/chats/types"

export type ChatTimeframe = "today" | "7d" | "30d" | "90d" | "custom"

export interface ChatFilters {
  pipelineRunDate: string | null
  timeframe: ChatTimeframe | null
  customRange: { from: string; to: string } | null
  topicIds: string[]
  trackedPromptIds: string[]
  brandEntityIds: string[]
  sourceDomainIds: string[]
  search: string
}

interface NormalizeChatFiltersInput {
  topics?: Array<{ id: string }>
  prompts?: Array<{ id: string; project_topic_id: string }>
  brands?: Array<{ id: string }>
  domains?: Array<{ id: string }>
}

const DAY_MS = 24 * 60 * 60 * 1000

export function emptyFilters(): ChatFilters {
  return {
    brandEntityIds: [],
    customRange: null,
    pipelineRunDate: null,
    search: "",
    sourceDomainIds: [],
    timeframe: null,
    topicIds: [],
    trackedPromptIds: [],
  }
}

export function hasActiveFilters(filters: ChatFilters): boolean {
  return (
    filters.pipelineRunDate !== null ||
    filters.timeframe !== null ||
    filters.customRange !== null ||
    filters.topicIds.length > 0 ||
    filters.trackedPromptIds.length > 0 ||
    filters.brandEntityIds.length > 0 ||
    filters.sourceDomainIds.length > 0 ||
    filters.search.trim().length > 0
  )
}

function toDay(dateString: string): string {
  return dateString.slice(0, 10)
}

function toUtcDayStart(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`)
}

function isWithinTimeframe(
  scheduledFor: string,
  timeframe: ChatTimeframe,
  customRange: ChatFilters["customRange"],
  now: number
): boolean {
  const ts = Date.parse(scheduledFor)

  if (Number.isNaN(ts)) {
    return false
  }

  if (timeframe === "custom") {
    if (!customRange) {
      return true
    }

    const from = toUtcDayStart(customRange.from)
    const to = toUtcDayStart(customRange.to) + DAY_MS

    return ts >= from && ts < to
  }

  const windowDays =
    timeframe === "today" ? 1 :
    timeframe === "7d" ? 7 :
    timeframe === "30d" ? 30 :
    timeframe === "90d" ? 90 :
    0

  return ts >= now - windowDays * DAY_MS
}

export function applyFilters(
  chats: ChatSummary[],
  filters: ChatFilters,
  now: number = Date.now()
): ChatSummary[] {
  const search = filters.search.trim().toLowerCase()
  const topicSet = new Set(filters.topicIds)
  const promptSet = new Set(filters.trackedPromptIds)
  const brandSet = new Set(filters.brandEntityIds)

  return chats.filter((chat) => {
    if (filters.pipelineRunDate) {
      if (toDay(chat.scheduledFor) !== filters.pipelineRunDate) {
        return false
      }
    } else if (filters.timeframe) {
      if (
        !isWithinTimeframe(
          chat.scheduledFor,
          filters.timeframe,
          filters.customRange,
          now
        )
      ) {
        return false
      }
    }

    if (topicSet.size > 0 && !topicSet.has(chat.projectTopicId)) {
      return false
    }

    if (promptSet.size > 0 && !promptSet.has(chat.trackedPromptId)) {
      return false
    }

    if (brandSet.size > 0) {
      const hasMatch = chat.brandMentions.some((mention) =>
        brandSet.has(mention.brandEntityId)
      )

      if (!hasMatch) {
        return false
      }
    }

    if (search && !chat.promptText.toLowerCase().includes(search)) {
      return false
    }

    return true
  })
}

const TIMEFRAMES: ChatTimeframe[] = ["today", "7d", "30d", "90d", "custom"]

function isTimeframe(value: string | null): value is ChatTimeframe {
  return value !== null && (TIMEFRAMES as string[]).includes(value)
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}

export function filtersToQueryString(filters: ChatFilters): string {
  const params = new URLSearchParams()

  if (filters.pipelineRunDate) {
    params.set("pipelineRunDate", filters.pipelineRunDate)
  }

  if (filters.timeframe) {
    params.set("timeframe", filters.timeframe)
  }

  if (filters.customRange) {
    params.set("from", filters.customRange.from)
    params.set("to", filters.customRange.to)
  }

  if (filters.topicIds.length > 0) {
    params.set("topics", filters.topicIds.join(","))
  }

  if (filters.trackedPromptIds.length > 0) {
    params.set("prompts", filters.trackedPromptIds.join(","))
  }

  if (filters.brandEntityIds.length > 0) {
    params.set("brands", filters.brandEntityIds.join(","))
  }

  if (filters.sourceDomainIds.length > 0) {
    params.set("sources", filters.sourceDomainIds.join(","))
  }

  if (filters.search.trim().length > 0) {
    params.set("q", filters.search.trim())
  }

  return params.toString()
}

function splitList(value: string | null): string[] {
  if (!value) {
    return []
  }

  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

function filterKnownIds(
  values: string[],
  allowed: Array<{ id: string }> | undefined
): string[] {
  if (!allowed) {
    return [...values]
  }

  const allowedIds = new Set(allowed.map((item) => item.id))

  return values.filter((value) => allowedIds.has(value))
}

export function filtersFromQueryString(params: URLSearchParams): ChatFilters {
  const next = emptyFilters()

  const pipelineRunDate = params.get("pipelineRunDate")

  if (pipelineRunDate && isIsoDate(pipelineRunDate)) {
    next.pipelineRunDate = pipelineRunDate
  }

  const timeframe = params.get("timeframe")

  if (isTimeframe(timeframe)) {
    next.timeframe = timeframe
  }

  const from = params.get("from")
  const to = params.get("to")

  if (from && to && isIsoDate(from) && isIsoDate(to)) {
    next.customRange = { from, to }
  }

  next.topicIds = splitList(params.get("topics"))
  next.trackedPromptIds = splitList(params.get("prompts"))
  next.brandEntityIds = splitList(params.get("brands"))
  next.sourceDomainIds = splitList(params.get("sources"))
  next.search = params.get("q") ?? ""

  return next
}

export function normalizeChatFilters(
  filters: ChatFilters,
  input: NormalizeChatFiltersInput
): ChatFilters {
  const topicIds = filterKnownIds(filters.topicIds, input.topics)
  const prompts = input.prompts
  const allowedPromptIds =
    prompts
      ? prompts.filter((prompt) =>
          topicIds.length === 0 ? true : topicIds.includes(prompt.project_topic_id)
        )
      : undefined
  const trackedPromptIds = filterKnownIds(
    filters.trackedPromptIds,
    allowedPromptIds?.map((prompt) => ({ id: prompt.id }))
  )
  const pipelineRunDate = filters.pipelineRunDate
  const timeframe = pipelineRunDate ? null : filters.timeframe
  const customRange =
    pipelineRunDate || timeframe !== "custom" ? null : filters.customRange

  return {
    brandEntityIds: filterKnownIds(filters.brandEntityIds, input.brands),
    customRange,
    pipelineRunDate,
    search: filters.search,
    sourceDomainIds: filterKnownIds(filters.sourceDomainIds, input.domains),
    timeframe,
    topicIds,
    trackedPromptIds,
  }
}
