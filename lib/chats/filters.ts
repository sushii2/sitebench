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

    const from = Date.parse(customRange.from)
    const to = Date.parse(customRange.to)

    return ts >= from && ts <= to
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
