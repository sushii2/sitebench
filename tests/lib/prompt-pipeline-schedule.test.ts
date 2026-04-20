import { describe, expect, it } from "vitest"

import {
  advancePromptPipelineSchedule,
  computeInitialPromptPipelineRunAt,
  getPromptPipelineFrequencyLabel,
} from "@/lib/prompt-pipeline/schedule"

describe("prompt pipeline schedule helpers", () => {
  it("computes the initial next run from the config save timestamp", () => {
    expect(
      computeInitialPromptPipelineRunAt(
        "2026-04-20T12:00:00.000Z",
        "every_2_days"
      )
    ).toBe("2026-04-22T12:00:00.000Z")
  })

  it("advances from the previous scheduled timestamp to avoid drift", () => {
    expect(
      advancePromptPipelineSchedule(
        "2026-04-20T12:00:00.000Z",
        "weekly",
        2
      )
    ).toBe("2026-05-04T12:00:00.000Z")
  })

  it("returns user-facing frequency labels", () => {
    expect(getPromptPipelineFrequencyLabel("daily")).toBe("1 day")
    expect(getPromptPipelineFrequencyLabel("every_3_days")).toBe("3 days")
    expect(getPromptPipelineFrequencyLabel("every_2_weeks")).toBe("2 weeks")
  })
})
