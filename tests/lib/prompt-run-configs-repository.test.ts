import { describe, expect, it, vi } from "vitest"

import {
  disablePromptRunConfig,
  loadPromptRunConfig,
  upsertPromptRunConfig,
} from "@/lib/prompt-run-configs/repository"

function makeQueryBuilder<TResult>(result?: TResult) {
  const builder: Record<string, unknown> = {}

  builder.eq = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(() => builder)
  builder.select = vi.fn(() => builder)
  builder.then = vi.fn((resolve) => Promise.resolve(resolve(result)))
  builder.update = vi.fn(() => builder)

  return builder as {
    eq: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    select: ReturnType<typeof vi.fn>
    then: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    cadence_days: 7,
    claimed_at: null,
    created_at: "2026-04-21T00:00:00.000Z",
    current_run_id: null,
    enabled_providers: ["chatgpt", "claude"],
    id: "config-1",
    is_enabled: true,
    last_run_at: null,
    next_run_at: null,
    project_id: "project-1",
    scheduled_run_local_time: "09:00",
    selected_project_topic_ids: ["topic-1"],
    selected_tracked_prompt_ids: ["prompt-1"],
    updated_at: "2026-04-21T00:00:00.000Z",
    ...overrides,
  }
}

describe("prompt run config repository", () => {
  it("loads a prompt run config by project", async () => {
    const selectBuilder = makeQueryBuilder({
      data: makeConfig(),
      error: null,
    })
    const client = {
      database: {
        from: vi.fn(() => selectBuilder),
      },
    }

    const result = await loadPromptRunConfig(client as never, "project-1")

    expect(result).toEqual(makeConfig())
    expect(selectBuilder.eq).toHaveBeenCalledWith("project_id", "project-1")
  })

  it("inserts a new config when none exists", async () => {
    const loadBuilder = makeQueryBuilder({
      data: null,
      error: null,
    })
    const insertBuilder = makeQueryBuilder({
      data: makeConfig(),
      error: null,
    })
    const from = vi.fn((table: string) => {
      if (table !== "prompt_run_configs") {
        throw new Error(`Unexpected table: ${table}`)
      }

      return from.mock.calls.length === 1 ? loadBuilder : insertBuilder
    })
    const client = {
      database: {
        from,
      },
    }

    const result = await upsertPromptRunConfig(client as never, {
      cadenceDays: 7,
      enabledProviders: ["chatgpt", "claude"],
      projectId: "project-1",
      scheduledRunLocalTime: "09:00",
      selectedProjectTopicIds: ["topic-1"],
      selectedTrackedPromptIds: ["prompt-1"],
    })

    expect(result).toEqual(makeConfig())
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        cadence_days: 7,
        enabled_providers: ["chatgpt", "claude"],
        project_id: "project-1",
      }),
    ])
  })

  it("updates an existing config", async () => {
    const loadBuilder = makeQueryBuilder({
      data: makeConfig(),
      error: null,
    })
    const updateBuilder = makeQueryBuilder({
      data: makeConfig({
        cadence_days: 3,
      }),
      error: null,
    })
    const from = vi.fn((table: string) => {
      if (table !== "prompt_run_configs") {
        throw new Error(`Unexpected table: ${table}`)
      }

      return from.mock.calls.length === 1 ? loadBuilder : updateBuilder
    })
    const client = {
      database: {
        from,
      },
    }

    const result = await upsertPromptRunConfig(client as never, {
      cadenceDays: 3,
      enabledProviders: ["perplexity"],
      projectId: "project-1",
      scheduledRunLocalTime: "14:30",
      selectedProjectTopicIds: ["topic-1"],
      selectedTrackedPromptIds: ["prompt-1"],
    })

    expect(result).toEqual(
      makeConfig({
        cadence_days: 3,
      })
    )
    expect(updateBuilder.update).toHaveBeenCalledWith({
      cadence_days: 3,
      enabled_providers: ["perplexity"],
      is_enabled: true,
      project_id: "project-1",
      scheduled_run_local_time: "14:30",
      selected_project_topic_ids: ["topic-1"],
      selected_tracked_prompt_ids: ["prompt-1"],
    })
  })

  it("disables a saved config", async () => {
    const updateBuilder = makeQueryBuilder({
      data: makeConfig({
        is_enabled: false,
      }),
      error: null,
    })
    const client = {
      database: {
        from: vi.fn(() => updateBuilder),
      },
    }

    const result = await disablePromptRunConfig(client as never, "project-1")

    expect(result).toEqual(
      makeConfig({
        is_enabled: false,
      })
    )
    expect(updateBuilder.update).toHaveBeenCalledWith({
      claimed_at: null,
      current_run_id: null,
      is_enabled: false,
    })
  })
})
