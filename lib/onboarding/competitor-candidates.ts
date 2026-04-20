import { generateText, NoOutputGeneratedError, Output, stepCountIs } from "ai"

import { buildGatewayStructuredOutputSystemPrompt } from "@/lib/ai/gateway-structured-output"
import {
  getLanguageModel,
  getOpenAiWebSearchTool,
} from "@/lib/ai/provider-config"
import {
  onboardingCompetitorRecoverySchema,
  type OnboardingBrandProfile,
  type OnboardingCompetitor,
} from "@/lib/onboarding/types"

const WEB_RESEARCH_MAX_STEPS = 8
const SEARCH_ASSISTED_MODEL_ID = "openai/gpt-5.4-mini"

function dedupeCompetitors(competitors: OnboardingCompetitor[]) {
  const seen = new Set<string>()

  return competitors.filter((competitor) => {
    const key = `${competitor.name.trim().toLowerCase()}|${competitor.website
      .trim()
      .toLowerCase()}`

    if (!competitor.name.trim() || !competitor.website.trim() || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

export async function generateCompetitorCandidates(input: {
  brandProfile: OnboardingBrandProfile
  companyName: string
  website: string
}) {
  try {
    const { output } = await generateText({
      model: getLanguageModel("openai", {
        capability: "webSearch",
        modelId: SEARCH_ASSISTED_MODEL_ID,
      }),
      output: Output.object({
        description:
          "Structured direct competitor candidates for the current brand profile.",
        name: "onboarding_competitor_candidates",
        schema: onboardingCompetitorRecoverySchema,
      }),
      prompt: [
        `Company: ${input.companyName}`,
        `Website: ${input.website}`,
        `Primary category: ${input.brandProfile.primaryCategory}`,
        `Secondary categories: ${input.brandProfile.secondaryCategories.join(", ") || "(none)"}`,
        `Description: ${input.brandProfile.detailedDescription}`,
        `Target customers: ${input.brandProfile.targetCustomers.join(", ") || "(none)"}`,
        `Differentiators: ${input.brandProfile.differentiators.join(", ") || "(none)"}`,
        `Comparison sets: ${input.brandProfile.comparisonSets.join(", ") || "(none)"}`,
        `Research journeys: ${input.brandProfile.researchJourneys.join(", ") || "(none)"}`,
      ].join("\n"),
      system: buildGatewayStructuredOutputSystemPrompt([
        "Find direct or near-direct competitors for the supplied brand profile.",
        "Search for the brand name and domain first, then the category and comparison terms buyers use.",
        "Use search-supported category overlap and buyer overlap.",
        "Prefer official competitor homepages and high-signal comparison pages.",
        "Exclude the input company, agencies, publishers, marketplaces, partners, and obvious non-competitors unless the overlap is direct.",
        "Return an empty competitor list rather than weak guesses.",
        "Return only the schema fields.",
      ]),
      temperature: 0,
      tools: {
        web_search: getOpenAiWebSearchTool(),
      },
      stopWhen: stepCountIs(WEB_RESEARCH_MAX_STEPS),
      onStepFinish({ finishReason, stepNumber, text, toolCalls, toolResults, usage }) {
        console.log("[onboarding] Competitor candidate step finished", {
          finishReason,
          stepNumber,
          textLength: text.length,
          toolCallCount: toolCalls.length,
          toolResultCount: toolResults.length,
          usage,
        })
      },
    })

    return dedupeCompetitors(
      onboardingCompetitorRecoverySchema.parse(output).competitors
    ).slice(0, 10)
  } catch (error) {
    if (NoOutputGeneratedError.isInstance(error)) {
      console.warn("[onboarding] Competitor candidate search produced no final output", {
        cause:
          error.cause instanceof Error ? error.cause.message : error.cause ?? null,
      })
    }

    throw error
  }
}
