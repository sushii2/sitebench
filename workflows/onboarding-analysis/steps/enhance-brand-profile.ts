import { enhanceBrandProfile, getEnhancementFallbackWarning, toOnboardingBrandProfile } from "@/lib/onboarding/homepage-analysis"

import {
  extendTimings,
  logStepError,
  persistRunPhase,
  uniqueWarnings,
} from "@/workflows/onboarding-analysis/steps/shared"
import type {
  ProfiledState,
  SeededState,
} from "@/workflows/onboarding-analysis/types"

export async function enhanceBrandProfileStep(
  input: SeededState
): Promise<ProfiledState> {
  "use step"

  const startedAt = Date.now()
  let warnings = [...input.warnings]
  let enhancedBrandProfile = null

  await persistRunPhase({
    analysisId: input.analysisId,
    authToken: input.authToken,
    status: "enhancing",
    warnings,
  })

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      enhancedBrandProfile = await enhanceBrandProfile({
        companyName: input.companyName,
        homepageArtifact: input.homepageArtifact,
        seedBrandProfile: input.seedBrandProfile,
        website: input.website,
      })
      break
    } catch (error) {
      logStepError("Workflow brand-profile enhancement failed", error, {
        analysisId: input.analysisId,
        attempt: attempt + 1,
        website: input.website,
      })

      if (attempt === 1) {
        warnings = uniqueWarnings([
          ...warnings,
          getEnhancementFallbackWarning(),
        ])
      }
    }
  }

  return {
    ...input,
    brandProfile: toOnboardingBrandProfile({
      enhancedBrandProfile,
      homepageArtifact: input.homepageArtifact,
      seedBrandProfile: input.seedBrandProfile,
      warnings,
    }),
    enhancedBrandProfile,
    timings: extendTimings(input.timings, "enhanceBrandProfileMs", startedAt),
    warnings,
  }
}

enhanceBrandProfileStep.maxRetries = 1
