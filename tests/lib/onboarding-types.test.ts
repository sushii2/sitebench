import { describe, expect, it } from "vitest"

import {
  onboardingAiSuggestionSchema,
  onboardingCompetitorRecoverySchema,
} from "@/lib/onboarding/types"

describe("onboarding structured output schemas", () => {
  it("requires every competitor field for tier 1 suggestions", () => {
    const result = onboardingAiSuggestionSchema.safeParse({
      competitors: [{ website: "https://competitor-1.com" }],
      description: "",
      topics: [],
    })

    expect(result.success).toBe(false)
  })

  it("requires every competitor field for tier 2 recovery", () => {
    const result = onboardingCompetitorRecoverySchema.safeParse({
      competitors: [{ name: "Competitor 1" }],
    })

    expect(result.success).toBe(false)
  })
})
