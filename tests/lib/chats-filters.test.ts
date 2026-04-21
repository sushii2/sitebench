import { describe, expect, it } from "vitest"

import {
  applyFilters,
  emptyFilters,
  hasActiveFilters,
} from "@/lib/chats/filters"
import type { ChatSummary } from "@/lib/chats/types"

function makeSummary(overrides: Partial<ChatSummary> = {}): ChatSummary {
  return {
    brandMentions: [],
    completedAt: "2026-04-20T12:00:00.000Z",
    platforms: [],
    promptRunId: "run-1",
    promptText: "Best Next.js deployment platform?",
    projectTopicId: "topic-1",
    scheduledFor: "2026-04-20T10:00:00.000Z",
    sourceCount: 0,
    status: "completed",
    topicName: "Deployment",
    trackedPromptId: "prompt-1",
    ...overrides,
  }
}

describe("chat filters", () => {
  it("returns all rows when no filters are active", () => {
    const summaries = [makeSummary(), makeSummary({ promptRunId: "run-2" })]
    const result = applyFilters(summaries, emptyFilters())

    expect(result).toHaveLength(2)
  })

  it("filters by topic ids", () => {
    const summaries = [
      makeSummary({ projectTopicId: "topic-a" }),
      makeSummary({ projectTopicId: "topic-b", promptRunId: "run-2" }),
    ]

    const result = applyFilters(summaries, {
      ...emptyFilters(),
      topicIds: ["topic-a"],
    })

    expect(result).toHaveLength(1)
    expect(result[0].projectTopicId).toBe("topic-a")
  })

  it("filters by tracked prompt ids", () => {
    const summaries = [
      makeSummary({ trackedPromptId: "prompt-a" }),
      makeSummary({ trackedPromptId: "prompt-b", promptRunId: "run-2" }),
    ]

    const result = applyFilters(summaries, {
      ...emptyFilters(),
      trackedPromptIds: ["prompt-b"],
    })

    expect(result).toHaveLength(1)
    expect(result[0].trackedPromptId).toBe("prompt-b")
  })

  it("filters by brand ids", () => {
    const summaries = [
      makeSummary({
        brandMentions: [
          { brandEntityId: "brand-a", name: "A", role: "primary" },
        ],
      }),
      makeSummary({
        brandMentions: [
          { brandEntityId: "brand-b", name: "B", role: "competitor" },
        ],
        promptRunId: "run-2",
      }),
    ]

    const result = applyFilters(summaries, {
      ...emptyFilters(),
      brandEntityIds: ["brand-a"],
    })

    expect(result).toHaveLength(1)
    expect(result[0].promptRunId).toBe("run-1")
  })

  it("filters by pipeline run date (exact day)", () => {
    const summaries = [
      makeSummary({ scheduledFor: "2026-04-20T10:00:00.000Z" }),
      makeSummary({
        scheduledFor: "2026-04-21T10:00:00.000Z",
        promptRunId: "run-2",
      }),
    ]

    const result = applyFilters(summaries, {
      ...emptyFilters(),
      pipelineRunDate: "2026-04-21",
    })

    expect(result).toHaveLength(1)
    expect(result[0].promptRunId).toBe("run-2")
  })

  it("filters by timeframe 7d", () => {
    const now = Date.now()
    const recent = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
    const old = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

    const summaries = [
      makeSummary({ scheduledFor: recent }),
      makeSummary({ scheduledFor: old, promptRunId: "run-2" }),
    ]

    const result = applyFilters(summaries, {
      ...emptyFilters(),
      timeframe: "7d",
    })

    expect(result).toHaveLength(1)
    expect(result[0].promptRunId).toBe("run-1")
  })

  it("pipeline run date overrides timeframe", () => {
    const now = Date.now()
    const recent = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()

    const summaries = [
      makeSummary({ scheduledFor: recent }),
      makeSummary({
        scheduledFor: "2026-01-01T10:00:00.000Z",
        promptRunId: "run-2",
      }),
    ]

    const result = applyFilters(summaries, {
      ...emptyFilters(),
      pipelineRunDate: "2026-01-01",
      timeframe: "7d",
    })

    expect(result).toHaveLength(1)
    expect(result[0].promptRunId).toBe("run-2")
  })

  it("filters by free-text search on promptText (case-insensitive)", () => {
    const summaries = [
      makeSummary({ promptText: "Best Next.js deployment platform?" }),
      makeSummary({
        promptText: "How do I host a static site?",
        promptRunId: "run-2",
      }),
    ]

    const result = applyFilters(summaries, {
      ...emptyFilters(),
      search: "next.js",
    })

    expect(result).toHaveLength(1)
    expect(result[0].promptRunId).toBe("run-1")
  })

  it("hasActiveFilters is false for empty filters, true when any are set", () => {
    expect(hasActiveFilters(emptyFilters())).toBe(false)
    expect(
      hasActiveFilters({ ...emptyFilters(), topicIds: ["topic-a"] })
    ).toBe(true)
    expect(hasActiveFilters({ ...emptyFilters(), search: "x" })).toBe(true)
  })
})
