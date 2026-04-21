import { describe, expect, it } from "vitest"

import {
  mapChatSummaryRows,
  mapPipelineRunBatchRows,
} from "@/lib/chats/repository"
import type { AiPlatform } from "@/lib/ai-platforms/types"

const platforms: AiPlatform[] = [
  {
    code: "chatgpt",
    created_at: "2026-01-01T00:00:00.000Z",
    is_active: true,
    label: "ChatGPT",
    sort_order: 0,
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    code: "claude",
    created_at: "2026-01-01T00:00:00.000Z",
    is_active: true,
    label: "Claude",
    sort_order: 1,
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    code: "perplexity",
    created_at: "2026-01-01T00:00:00.000Z",
    is_active: true,
    label: "Perplexity",
    sort_order: 2,
    updated_at: "2026-01-01T00:00:00.000Z",
  },
]

function makeRawRun(overrides: Record<string, unknown> = {}) {
  return {
    cadence_applied: "daily",
    completed_at: "2026-04-20T12:00:00.000Z",
    created_at: "2026-04-20T10:00:00.000Z",
    failure_reason: null,
    id: "run-1",
    project_id: "project-1",
    project_topic_id: "topic-1",
    project_topics: { id: "topic-1", name: "Deployment" },
    prompt_run_responses: [
      {
        id: "resp-1",
        platform_code: "chatgpt",
        response_brand_metrics: [
          {
            brand_entities: {
              id: "brand-1",
              name: "Vercel",
              role: "primary",
            },
            brand_entity_id: "brand-1",
          },
        ],
        response_citations: [{ id: "cit-1" }, { id: "cit-2" }],
        status: "completed",
      },
      {
        id: "resp-2",
        platform_code: "claude",
        response_brand_metrics: [],
        response_citations: [],
        status: "completed",
      },
    ],
    scheduled_for: "2026-04-20T10:00:00.000Z",
    started_at: "2026-04-20T10:00:01.000Z",
    status: "completed",
    tracked_prompt_id: "prompt-1",
    tracked_prompts: {
      id: "prompt-1",
      prompt_text: "Best Next.js deployment platform?",
    },
    trigger_type: "scheduled",
    ...overrides,
  }
}

describe("mapChatSummaryRows", () => {
  it("builds a summary row with topic, prompt, platforms, brands, and source count", () => {
    const result = mapChatSummaryRows([makeRawRun()], platforms)

    expect(result).toHaveLength(1)
    const row = result[0]

    expect(row.promptRunId).toBe("run-1")
    expect(row.topicName).toBe("Deployment")
    expect(row.promptText).toBe("Best Next.js deployment platform?")
    expect(row.sourceCount).toBe(2)
    expect(row.brandMentions).toEqual([
      { brandEntityId: "brand-1", name: "Vercel", role: "primary" },
    ])
  })

  it("emits platforms in ai_platforms.sort_order with missing status when no response", () => {
    const result = mapChatSummaryRows([makeRawRun()], platforms)

    expect(result[0].platforms.map((p) => p.code)).toEqual([
      "chatgpt",
      "claude",
      "perplexity",
    ])
    expect(result[0].platforms[2].status).toBe("missing")
    expect(result[0].platforms[2].responseId).toBeNull()
  })

  it("deduplicates brand mentions across platform responses", () => {
    const run = makeRawRun({
      prompt_run_responses: [
        {
          id: "resp-1",
          platform_code: "chatgpt",
          response_brand_metrics: [
            {
              brand_entities: { id: "brand-1", name: "Vercel", role: "primary" },
              brand_entity_id: "brand-1",
            },
          ],
          response_citations: [],
          status: "completed",
        },
        {
          id: "resp-2",
          platform_code: "claude",
          response_brand_metrics: [
            {
              brand_entities: { id: "brand-1", name: "Vercel", role: "primary" },
              brand_entity_id: "brand-1",
            },
            {
              brand_entities: {
                id: "brand-2",
                name: "Netlify",
                role: "competitor",
              },
              brand_entity_id: "brand-2",
            },
          ],
          response_citations: [],
          status: "completed",
        },
      ],
    })

    const result = mapChatSummaryRows([run], platforms)

    expect(result[0].brandMentions).toHaveLength(2)
    expect(result[0].brandMentions.map((b) => b.brandEntityId).sort()).toEqual([
      "brand-1",
      "brand-2",
    ])
  })

  it("tolerates missing nested fields", () => {
    const run = makeRawRun({
      prompt_run_responses: null,
      project_topics: null,
      tracked_prompts: null,
    })

    const result = mapChatSummaryRows([run], platforms)

    expect(result[0].topicName).toBe("")
    expect(result[0].promptText).toBe("")
    expect(result[0].brandMentions).toEqual([])
    expect(result[0].sourceCount).toBe(0)
    expect(result[0].platforms.every((p) => p.status === "missing")).toBe(true)
  })
})

describe("mapPipelineRunBatchRows", () => {
  it("groups runs by scheduled_for date and counts them descending", () => {
    const rows = [
      { scheduled_for: "2026-04-20T09:00:00.000Z" },
      { scheduled_for: "2026-04-20T10:00:00.000Z" },
      { scheduled_for: "2026-04-21T11:00:00.000Z" },
    ]

    const result = mapPipelineRunBatchRows(rows)

    expect(result).toEqual([
      { count: 1, date: "2026-04-21" },
      { count: 2, date: "2026-04-20" },
    ])
  })
})
