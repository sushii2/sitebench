import { describe, expect, it, vi } from "vitest"

import {
  normalizePromptText,
  syncTrackedPromptsForTopics,
} from "@/lib/tracked-prompts/repository"

function makeQueryBuilder<TResult>(result?: TResult) {
  const builder: Record<string, unknown> = {}

  builder.eq = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.select = vi.fn(() => builder)
  builder.then = vi.fn((resolve) => Promise.resolve(resolve(result)))
  builder.update = vi.fn(() => builder)

  return builder as {
    eq: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    select: ReturnType<typeof vi.fn>
    then: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

function makePrompt(overrides: Record<string, unknown> = {}) {
  return {
    added_via: "ai_suggested",
    cadence_override: null,
    created_at: "2026-01-01T00:00:00.000Z",
    id: "prompt-1",
    is_active: true,
    last_run_at: null,
    next_run_at: null,
    normalized_prompt: "best ai search tools",
    pqs_rank: 1,
    pqs_score: 91,
    project_id: "project-1",
    project_topic_id: "topic-1",
    prompt_catalog_id: null,
    prompt_text: "Best AI search tools",
    score_metadata: {
      buyerValue: 15,
      evidenceGrounding: 10,
      naturalUserPhrasing: 18,
      specificity: 14,
      topicFit: 28,
    },
    score_status: "scored",
    source_analysis_run_id: "analysis-1",
    updated_at: "2026-01-01T00:00:00.000Z",
    variant_type: "discovery",
    ...overrides,
  }
}

describe("tracked prompt repository", () => {
  it("normalizes prompt text for dedupe", () => {
    expect(normalizePromptText("  Best   AI Search Tools  ")).toBe(
      "best ai search tools"
    )
  })

  it("preserves unchanged prompts and deactivates removed ones", async () => {
    const selectBuilder = makeQueryBuilder({
      data: [
        makePrompt(),
        makePrompt({
          id: "prompt-2",
          normalized_prompt: "compare acme vs openai",
          prompt_text: "Compare Acme vs OpenAI",
        }),
      ],
      error: null,
    })
    const updateBuilder = makeQueryBuilder({
      data: [makePrompt()],
      error: null,
    })
    const deactivateBuilder = makeQueryBuilder({
      data: [makePrompt({ id: "prompt-2", is_active: false })],
      error: null,
    })
    const insertBuilder = makeQueryBuilder({
      data: [],
      error: null,
    })
    const finalSelectBuilder = makeQueryBuilder({
      data: [makePrompt()],
      error: null,
    })
    const from = vi.fn((table: string) => {
      if (table !== "tracked_prompts") {
        throw new Error(`Unexpected table: ${table}`)
      }

      if (from.mock.calls.length === 1) {
        return selectBuilder
      }

      if (from.mock.calls.length === 2) {
        return updateBuilder
      }

      if (from.mock.calls.length === 3) {
        return deactivateBuilder
      }

      if (from.mock.calls.length === 4) {
        return finalSelectBuilder
      }

      if (from.mock.calls.length === 5) {
        return insertBuilder
      }

      return finalSelectBuilder
    })
    const client = {
      database: {
        from,
      },
    }

    const result = await syncTrackedPromptsForTopics(client as never, {
      projectId: "project-1",
      topics: [
        {
          prompts: [
            {
              addedVia: "ai_suggested",
              pqsRank: 1,
              pqsScore: 91,
              promptText: "Best AI search tools",
              scoreMetadata: {
                buyerValue: 15,
              },
              scoreStatus: "scored",
              sourceAnalysisRunId: "analysis-1",
              variantType: "discovery",
            },
          ],
          topicId: "topic-1",
          topicName: "ai search",
        },
      ],
    })

    expect(result).toHaveLength(1)
    expect(deactivateBuilder.update).toHaveBeenCalledWith({
      is_active: false,
    })
    expect(updateBuilder.update).toHaveBeenCalledWith({
      added_via: "ai_suggested",
      is_active: true,
      pqs_rank: 1,
      pqs_score: 91,
      prompt_catalog_id: null,
      prompt_text: "Best AI search tools",
      score_metadata: {
        buyerValue: 15,
      },
      score_status: "scored",
      source_analysis_run_id: "analysis-1",
      variant_type: "discovery",
    })
    expect(deactivateBuilder.in).toHaveBeenCalledWith("id", ["prompt-2"])
    expect(insertBuilder.insert).not.toHaveBeenCalled()
  })

  it("keeps onboarding prompts project-scoped when the prompt catalog has no matching template", async () => {
    const trackedSelectBuilder = makeQueryBuilder({
      data: [],
      error: null,
    })
    const promptCatalogSelectBuilder = makeQueryBuilder({
      data: [],
      error: null,
    })
    const trackedInsertBuilder = makeQueryBuilder({
      data: [
        makePrompt({
          id: "prompt-2",
          prompt_catalog_id: null,
        }),
      ],
      error: null,
    })
    const finalTrackedSelectBuilder = makeQueryBuilder({
      data: [
        makePrompt({
          id: "prompt-2",
          prompt_catalog_id: null,
        }),
      ],
      error: null,
    })
    const from = vi.fn((table: string) => {
      const call = from.mock.calls.length

      if (table === "tracked_prompts" && call === 1) {
        return trackedSelectBuilder
      }

      if (table === "prompt_catalog" && call === 2) {
        return promptCatalogSelectBuilder
      }

      if (table === "tracked_prompts" && call === 3) {
        return trackedInsertBuilder
      }

      if (table === "tracked_prompts" && call === 4) {
        return finalTrackedSelectBuilder
      }

      throw new Error(`Unexpected table call ${call}: ${table}`)
    })
    const client = {
      database: {
        from,
      },
    }

    const result = await syncTrackedPromptsForTopics(client as never, {
      projectId: "project-1",
      topics: [
        {
          prompts: [
            {
              addedVia: "ai_suggested",
              pqsRank: 1,
              pqsScore: 94,
              promptText: "Best AI search tools",
              scoreMetadata: {
                topicFit: 30,
              },
              scoreStatus: "scored",
              sourceAnalysisRunId: "analysis-1",
              templateText: "Best {topic} tools",
              variantType: "discovery",
            },
          ],
          topicId: "topic-1",
          topicName: "ai search",
        },
      ],
    })

    expect(result).toHaveLength(1)
    expect(trackedInsertBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        prompt_catalog_id: null,
        prompt_text: "Best AI search tools",
      }),
    ])
  })
})
