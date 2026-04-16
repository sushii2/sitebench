import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  loadProjectTopics,
  syncProjectTopics,
} from "@/lib/project-topics/repository"

function makeQueryBuilder<TResult>(result?: TResult) {
  const builder: Record<string, unknown> = {}

  builder.eq = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.select = vi.fn(() => builder)
  builder.then = vi.fn((resolve) => Promise.resolve(resolve(result)))
  builder.update = vi.fn(() => builder)

  return builder as {
    eq: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    select: ReturnType<typeof vi.fn>
    then: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

function makeTopic(overrides: Record<string, unknown> = {}) {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    default_cadence: "weekly",
    id: "topic-1",
    is_active: true,
    name: "ai search",
    normalized_name: "ai search",
    project_id: "project-1",
    sort_order: 0,
    source: "ai_suggested",
    topic_catalog_id: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

describe("project topic repository", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("loads project topics in sort order", async () => {
    const builder = makeQueryBuilder({
      data: [makeTopic()],
      error: null,
    })
    const client = {
      database: {
        from: vi.fn(() => builder),
      },
    }

    const result = await loadProjectTopics(client as never, "project-1")

    expect(result).toHaveLength(1)
    expect(client.database.from).toHaveBeenCalledWith("project_topics")
    expect(builder.eq).toHaveBeenCalledWith("project_id", "project-1")
    expect(builder.order).toHaveBeenCalledWith("sort_order", {
      ascending: true,
    })
  })

  it("preserves unchanged topics and deactivates removed topics", async () => {
    const selectBuilder = makeQueryBuilder({
      data: [
        makeTopic(),
        makeTopic({
          id: "topic-2",
          name: "perplexity",
          normalized_name: "perplexity",
          sort_order: 1,
          source: "user_added",
        }),
      ],
      error: null,
    })
    const updateBuilder = makeQueryBuilder({
      data: [makeTopic({ id: "topic-2", is_active: false })],
      error: null,
    })
    const insertBuilder = makeQueryBuilder({
      data: [],
      error: null,
    })
    const finalSelectBuilder = makeQueryBuilder({
      data: [makeTopic()],
      error: null,
    })
    const from = vi.fn((table: string) => {
      if (table !== "project_topics") {
        throw new Error(`Unexpected table: ${table}`)
      }

      if (from.mock.calls.length === 1) {
        return selectBuilder
      }

      if (from.mock.calls.length === 2) {
        return updateBuilder
      }

      if (from.mock.calls.length === 3) {
        return insertBuilder
      }

      return finalSelectBuilder
    })

    const client = {
      database: {
        from,
      },
    }

    const result = await syncProjectTopics(client as never, {
      projectId: "project-1",
      topics: [
        {
          source: "ai_suggested",
          topicName: "ai search",
        },
      ],
    })

    expect(result).toHaveLength(1)
    expect(updateBuilder.update).toHaveBeenCalledWith({
      is_active: false,
    })
    expect(updateBuilder.in).toHaveBeenCalledWith("id", ["topic-2"])
    expect(insertBuilder.insert).not.toHaveBeenCalled()
  })
})
