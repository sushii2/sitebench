import { generateText, NoOutputGeneratedError, Output } from "ai"

import { buildGatewayStructuredOutputSystemPrompt } from "@/lib/ai/gateway-structured-output"
import {
  getOnboardingSearchTools,
  getOnboardingSearchModel,
  ONBOARDING_SEARCH_PROVIDER_OPTIONS,
  getOnboardingStructuredOutputModel,
  ONBOARDING_STRUCTURED_OUTPUT_PROVIDER_OPTIONS,
} from "@/lib/onboarding/ai-config"
import {
  onboardingCompetitorRecoverySchema,
  type OnboardingBrandProfile,
  type OnboardingCompetitor,
} from "@/lib/onboarding/types"
import { createSingleSearchStructuredOutputLoopControl } from "@/lib/onboarding/search-loop-control"

function buildCompetitorCandidatePrompt(input: {
  brandProfile: OnboardingBrandProfile
  companyName: string
  website: string
}) {
  return [
    `Company: ${input.companyName}`,
    `Website: ${input.website}`,
    `Primary category: ${input.brandProfile.primaryCategory}`,
    `Secondary categories: ${input.brandProfile.secondaryCategories.join(", ") || "(none)"}`,
    `Description: ${input.brandProfile.detailedDescription}`,
    `Target customers: ${input.brandProfile.targetCustomers.join(", ") || "(none)"}`,
    `Differentiators: ${input.brandProfile.differentiators.join(", ") || "(none)"}`,
    `Comparison sets: ${input.brandProfile.comparisonSets.join(", ") || "(none)"}`,
    `Research journeys: ${input.brandProfile.researchJourneys.join(", ") || "(none)"}`,
  ].join("\n")
}

function buildCompetitorCandidateSystemPrompt(extraInstructions: string[] = []) {
  return buildGatewayStructuredOutputSystemPrompt([
    "Find direct or near-direct competitors for the supplied brand profile.",
    "Call parallel_search at most once.",
    "Search for the brand name and domain first, then the category and comparison terms buyers use.",
    "Use search-supported category overlap and buyer overlap.",
    "Prefer official competitor homepages and high-signal comparison pages.",
    "Exclude the input company, agencies, publishers, marketplaces, partners, and obvious non-competitors unless the overlap is direct.",
    "Return an empty competitor list rather than weak guesses.",
    "Return only the schema fields.",
    ...extraInstructions,
  ])
}

async function generateCompetitorCandidatesWithStructuredFallback(input: {
  brandProfile: OnboardingBrandProfile
  companyName: string
  website: string
}) {
  const { output } = await generateText({
    model: getOnboardingStructuredOutputModel(),
    output: Output.object({
      description:
        "Structured direct competitor candidates for the current brand profile.",
      name: "onboarding_competitor_candidates",
      schema: onboardingCompetitorRecoverySchema,
    }),
    prompt: buildCompetitorCandidatePrompt(input),
    system: buildCompetitorCandidateSystemPrompt([
      "Fallback mode: do not call tools.",
      "Use only the supplied brand profile, comparison sets, and research journeys.",
      "If the profile does not support direct competitors confidently, return an empty competitor list.",
    ]),
    providerOptions: ONBOARDING_STRUCTURED_OUTPUT_PROVIDER_OPTIONS,
    temperature: 0,
  })

  return output
}

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
    const searchTools = getOnboardingSearchTools()
    const searchLoopControl = createSingleSearchStructuredOutputLoopControl(
      searchTools,
      "[onboarding] Competitor candidate search disabled tools for final structured output"
    )

    const { output } = await generateText({
      model: getOnboardingSearchModel(),
      output: Output.object({
        description:
          "Structured direct competitor candidates for the current brand profile.",
        name: "onboarding_competitor_candidates",
        schema: onboardingCompetitorRecoverySchema,
      }),
      prompt: buildCompetitorCandidatePrompt(input),
      system: buildCompetitorCandidateSystemPrompt(),
      providerOptions: ONBOARDING_SEARCH_PROVIDER_OPTIONS,
      temperature: 0,
      tools: searchTools,
      ...searchLoopControl,
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

    console.warn("[onboarding] Competitor candidate search failed, using fallback", {
      error: error instanceof Error ? error.message : error,
      website: input.website,
    })

    const fallbackOutput =
      await generateCompetitorCandidatesWithStructuredFallback(input)

    return dedupeCompetitors(
      onboardingCompetitorRecoverySchema.parse(fallbackOutput).competitors
    ).slice(0, 10)
  }
}
