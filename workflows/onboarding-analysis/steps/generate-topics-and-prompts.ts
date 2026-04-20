import { normalizeWebsite } from "@/lib/brands"
import { generateTopicPromptCollection } from "@/lib/onboarding/topic-prompt-generator"
import type {
  OnboardingCatalog,
  OnboardingTopicPromptResponse,
} from "@/lib/onboarding/types"

import {
  extendTimings,
  logStepError,
  persistRunPhase,
  toErrorWarning,
  uniqueWarnings,
} from "@/workflows/onboarding-analysis/steps/shared"
import type {
  CompetitorState,
  PromptedState,
} from "@/workflows/onboarding-analysis/types"

function buildEmptyCatalog(input: CompetitorState): OnboardingCatalog {
  return {
    brand: input.companyName,
    businessType: input.brandProfile.siteArchetype,
    domain: new URL(normalizeWebsite(input.website)).hostname.replace(/^www\./i, ""),
    primaryCategory: input.brandProfile.primaryCategory,
    topics: [],
  }
}

export async function generateTopicsAndPromptsStep(
  input: CompetitorState
): Promise<PromptedState> {
  "use step"

  const startedAt = Date.now()
  let warnings = [...input.warnings]
  let promptCollection: OnboardingTopicPromptResponse = {
    catalog: buildEmptyCatalog(input),
    topics: [],
    warnings: [],
  }

  try {
    promptCollection = await generateTopicPromptCollection({
      analysisRunId: input.analysisId,
      brandProfile: input.brandProfile,
      companyName: input.companyName,
      competitors: input.competitors,
      description: input.brandProfile.detailedDescription,
      geoPromptStrategy: input.enhancedBrandProfile?.geoPromptStrategy,
      scrapedPages: [
        {
          competitorCandidates: input.competitors,
          contentSnapshot: input.homepageArtifact.markdown,
          entities: input.brandProfile.keywords,
          evidenceSnippets: input.brandProfile.differentiators,
          intents: input.brandProfile.researchJourneys,
          pageType: "homepage",
          title: input.seedBrandProfile.brandName,
          url: input.homepageArtifact.homepageUrl,
        },
      ],
      website: input.website,
    })
  } catch (error) {
    warnings = uniqueWarnings([
      ...warnings,
      toErrorWarning(
        "We could not fully generate the onboarding GEO catalog, so the run stored an empty prompt review for manual follow-up.",
        error
      ),
    ])
    logStepError("Workflow GEO catalog generation failed", error, {
      analysisId: input.analysisId,
      website: input.website,
    })
  }

  const result = {
    brandProfile: {
      ...input.brandProfile,
      warnings: uniqueWarnings([
        ...input.brandProfile.warnings,
        ...warnings,
        ...promptCollection.warnings,
      ]),
    },
    catalog: promptCollection.catalog,
    competitors: input.competitors,
    description: input.brandProfile.detailedDescription,
    topics: promptCollection.topics,
    warnings: uniqueWarnings([...warnings, ...promptCollection.warnings]),
  }

  await persistRunPhase({
    analysisId: input.analysisId,
    authToken: input.authToken,
    status: "prompting",
    warnings: result.warnings,
  })

  return {
    ...input,
    result,
    timings: extendTimings(input.timings, "generateTopicsAndPromptsMs", startedAt),
    topics: promptCollection.topics,
    warnings: result.warnings,
  }
}
