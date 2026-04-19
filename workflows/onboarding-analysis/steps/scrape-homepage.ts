import { scrapeBrandHomepage } from "@/lib/onboarding/firecrawl"

import {
  extendTimings,
  logStepError,
  persistRunPhase,
  toErrorWarning,
  uniqueWarnings,
} from "@/workflows/onboarding-analysis/steps/shared"
import type {
  HomepageState,
  MappedState,
} from "@/workflows/onboarding-analysis/types"

export async function scrapeHomepageStep(
  input: MappedState
): Promise<HomepageState> {
  "use step"

  const startedAt = Date.now()
  let homepage = null
  let warnings = [...input.warnings]

  try {
    homepage = await scrapeBrandHomepage(input.website)
  } catch (error) {
    warnings = uniqueWarnings([
      ...warnings,
      toErrorWarning("We could not scrape the homepage.", error),
    ])
    logStepError("Workflow homepage scrape failed", error, {
      analysisId: input.analysisId,
      website: input.website,
    })
  }

  await persistRunPhase({
    analysisId: input.analysisId,
    authToken: input.authToken,
    status: "classifying",
    warnings,
  })

  return {
    ...input,
    homepage,
    timings: extendTimings(input.timings, "scrapeHomepageMs", startedAt),
    warnings,
  }
}
