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
    project_id: "project-1",
    project_topic_id: "topic-1",
    prompt_catalog_id: null,
    prompt_text: "Best AI search tools",
    updated_at: "2026-01-01T00:00:00.000Z",
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
              promptText: "Best AI search tools",
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
    expect(deactivateBuilder.in).toHaveBeenCalledWith("id", ["prompt-2"])
    expect(insertBuilder.insert).not.toHaveBeenCalled()
  })
})
