import { describe, expect, it } from "vitest"

import {
  mapPromptMetricRuns,
  type PromptMetricRun,
} from "@/lib/prompt-metrics/repository"

function makeRun(overrides: Partial<PromptMetricRun> = {}): PromptMetricRun {
  return {
    completed_at: "2026-04-20T12:05:00.000Z",
    prompt_run_responses: [
      {
        platform_code: "chatgpt",
        responded_at: "2026-04-20T12:04:00.000Z",
        response_brand_metrics: [
          {
            brand_entities: { id: "brand-1", role: "primary" },
            rank_position: 2,
            sentiment_label: "positive",
            sentiment_score: 0.7,
            visibility_score: 64,
          },
          {
            brand_entities: { id: "brand-2", role: "competitor" },
            rank_position: 1,
            sentiment_label: "positive",
            sentiment_score: 0.6,
            visibility_score: 72,
          },
        ],
        status: "completed",
      },
    ],
    scheduled_for: "2026-04-20T12:00:00.000Z",
    tracked_prompt_id: "prompt-1",
    ...overrides,
  }
}

describe("mapPromptMetricRuns", () => {
  it("maps the latest platform response into prompt-level metrics", () => {
    const metrics = mapPromptMetricRuns([makeRun()], "chatgpt")

    expect(metrics).toEqual([
      {
        performerCount: 1,
        ranAt: "2026-04-20T12:04:00.000Z",
        sentiment: "positive",
        trackedPromptId: "prompt-1",
        visibility: 64,
      },
    ])
  })

  it("uses the latest run per prompt for the selected platform", () => {
    const metrics = mapPromptMetricRuns(
      [
        makeRun({
          completed_at: "2026-04-19T12:05:00.000Z",
          prompt_run_responses: [
            {
              platform_code: "chatgpt",
              responded_at: "2026-04-19T12:04:00.000Z",
              response_brand_metrics: [
                {
                  brand_entities: { id: "brand-1", role: "primary" },
                  rank_position: 1,
                  sentiment_label: "neutral",
                  sentiment_score: 0,
                  visibility_score: 40,
                },
              ],
              status: "completed",
            },
          ],
          scheduled_for: "2026-04-19T12:00:00.000Z",
        }),
        makeRun(),
      ],
      "chatgpt"
    )

    expect(metrics[0].visibility).toBe(64)
    expect(metrics[0].ranAt).toBe("2026-04-20T12:04:00.000Z")
  })

  it("returns null visibility/sentiment when the primary brand metric is missing", () => {
    const metrics = mapPromptMetricRuns(
      [
        makeRun({
          prompt_run_responses: [
            {
              platform_code: "chatgpt",
              responded_at: "2026-04-20T12:04:00.000Z",
              response_brand_metrics: [
                {
                  brand_entities: { id: "brand-2", role: "competitor" },
                  rank_position: 1,
                  sentiment_label: "positive",
                  sentiment_score: 0.8,
                  visibility_score: 80,
                },
              ],
              status: "completed",
            },
          ],
        }),
      ],
      "chatgpt"
    )

    expect(metrics).toEqual([
      {
        performerCount: 0,
        ranAt: "2026-04-20T12:04:00.000Z",
        sentiment: null,
        trackedPromptId: "prompt-1",
        visibility: null,
      },
    ])
  })
})
