import { FatalError, RetryableError } from "workflow"

import { buildSeedBrandProfile } from "@/lib/onboarding/homepage-analysis"

import {
  extendTimings,
  logStepError,
  persistRunPhase,
} from "@/workflows/onboarding-analysis/steps/shared"
import type {
  ScrapedHomepageState,
  SeededState,
} from "@/workflows/onboarding-analysis/types"

function classifySeedError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error"

  if (/429|5\d\d|timeout|timed out|temporar|network|provider/i.test(message)) {
    return new RetryableError(message)
  }

  return new FatalError(message)
}

export async function buildSeedBrandProfileStep(
  input: ScrapedHomepageState
): Promise<SeededState> {
  "use step"

  const startedAt = Date.now()

  await persistRunPhase({
    analysisId: input.analysisId,
    authToken: input.authToken,
    status: "seeding",
    warnings: input.warnings,
  })

  try {
    const seedBrandProfile = await buildSeedBrandProfile({
      companyName: input.companyName,
      homepageArtifact: input.homepageArtifact,
      website: input.website,
    })

    return {
      ...input,
      seedBrandProfile,
      timings: extendTimings(input.timings, "buildSeedBrandProfileMs", startedAt),
    }
  } catch (error) {
    logStepError("Workflow seed brand-profile synthesis failed", error, {
      analysisId: input.analysisId,
      website: input.website,
    })

    throw classifySeedError(error)
  }
}

buildSeedBrandProfileStep.maxRetries = 1
