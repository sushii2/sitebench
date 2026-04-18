import { describe, expect, it } from "vitest"

import {
  onboardingAiSuggestionSchema,
  onboardingBrandProfileSchema,
  onboardingCompetitorRecoverySchema,
  onboardingGatewayPromptGenerationSchema,
  onboardingGatewayPromptScoreSchema,
  onboardingGatewayTopicClusterSchema,
  onboardingPromptGenerationSchema,
  onboardingPromptScoreSchema,
  onboardingTopicClusterSchema,
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

  it("accepts structured topic output with plain source URL strings", () => {
    const result = onboardingTopicClusterSchema.safeParse({
      topics: [
        {
          clusterId: "cluster-1",
          intentSummary: "Buyer evaluation of AI visibility and pricing",
          source: "ai_suggested",
          sourceUrls: ["https://acme.com/compare", "not-normalized-yet"],
          topicName: "ai visibility",
        },
      ],
    })

    expect(result.success).toBe(true)
  })

  it("accepts gateway topic output with every key required", () => {
    const result = onboardingGatewayTopicClusterSchema.safeParse({
      topics: [
        {
          clusterId: "cluster-1",
          intentSummary: "Buyer evaluation of AI visibility and pricing",
          source: "ai_suggested",
          sourceUrls: ["https://acme.com/compare"],
          topicName: "ai visibility",
        },
      ],
    })

    expect(result.success).toBe(true)
  })

  it("accepts a structured brand profile with demand-scenario fields", () => {
    const result = onboardingBrandProfileSchema.safeParse({
      adjacentCategories: ["brand intelligence"],
      category: "AI visibility platform",
      competitors: [
        { name: "Competitor 1", website: "https://competitor-1.com" },
      ],
      description: "Acme helps teams measure AI visibility.",
      differentiators: ["citation tracking", "executive reporting"],
      evidenceUrls: ["https://acme.com/pricing"],
      productCategories: ["AI visibility"],
      targetAudiences: ["marketing teams"],
      topUseCases: ["track citations in ChatGPT"],
      warnings: [],
    })

    expect(result.success).toBe(true)
  })

  it("accepts prompt generation output with metadata per candidate prompt", () => {
    const result = onboardingPromptGenerationSchema.safeParse({
      topics: [
        {
          prompts: [
            {
              brandRelevance: "direct",
              commercialValue: "high",
              intentType: "comparison",
              likelyCompetitors: ["Competitor 1"],
              persona: "Marketing lead",
              promptText: "How does Acme compare with Competitor 1 on pricing?",
              purchaseStage: "decision",
              rationale: "Direct vendor evaluation.",
              segment: "marketing teams",
              templateText: "{company} vs {competitor_list} for {job_to_be_done}",
              variantType: "comparison",
            },
          ],
          topicName: "ai visibility",
        },
      ],
    })

    expect(result.success).toBe(true)
  })

  it("accepts gateway prompt generation output with all keys required", () => {
    const result = onboardingGatewayPromptGenerationSchema.safeParse({
      topics: [
        {
          prompts: [
            {
              brandRelevance: "direct",
              commercialValue: "high",
              intentType: "comparison",
              likelyCompetitors: ["Competitor 1"],
              persona: "Marketing lead",
              promptText: "How does Acme compare with Competitor 1 on pricing?",
              purchaseStage: "decision",
              rationale: "Direct vendor evaluation.",
              segment: "marketing teams",
              templateText: "{company} vs {competitor_list} for {job_to_be_done}",
              variantType: "comparison",
            },
          ],
          topicName: "ai visibility",
        },
      ],
    })

    expect(result.success).toBe(true)
  })

  it("accepts prompt scoring output with a fixed breakdown object", () => {
    const result = onboardingPromptScoreSchema.safeParse({
      scoredPrompts: [
        {
          breakdown: {
            brandCompetitorRelevance: 10,
            buyerValue: 15,
            evidenceGrounding: 10,
            naturalUserPhrasing: 20,
            specificity: 15,
            topicFit: 30,
          },
          evidenceUrls: ["https://acme.com/pricing"],
          keep: true,
          pqsScore: 93,
          reason: "Matches the evaluation intent and cites pricing context.",
          renderedPromptText: "How does Acme compare with Competitor 1 on pricing?",
          variantType: "comparison",
        },
      ],
    })

    expect(result.success).toBe(true)
  })

  it("accepts gateway prompt scoring output with nullable replacement text", () => {
    const result = onboardingGatewayPromptScoreSchema.safeParse({
      scoredPrompts: [
        {
          breakdown: {
            brandCompetitorRelevance: 10,
            buyerValue: 15,
            evidenceGrounding: 10,
            naturalUserPhrasing: 20,
            specificity: 15,
            topicFit: 30,
          },
          evidenceUrls: ["https://acme.com/pricing"],
          keep: true,
          pqsScore: 93,
          reason: "Matches the evaluation intent and cites pricing context.",
          renderedPromptText: "How does Acme compare with Competitor 1 on pricing?",
          replacementPromptText: null,
          variantType: "comparison",
        },
      ],
    })

    expect(result.success).toBe(true)
  })
})
