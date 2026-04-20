import { FatalError, RetryableError } from "workflow"

import { scrapeHomepageArtifact } from "@/lib/onboarding/homepage-analysis"

import {
  extendTimings,
  logStepError,
  persistRunPhase,
} from "@/workflows/onboarding-analysis/steps/shared"
import type {
  ScrapedHomepageState,
  WorkflowState,
} from "@/workflows/onboarding-analysis/types"

function classifyScrapeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error"

  if (
    /valid website|invalid url|enter a valid website|firecrawl_api_key/i.test(
      message
    )
  ) {
    return new FatalError(message)
  }

  if (
    /429|5\d\d|timeout|timed out|temporar|network|fetch failed|econn|socket/i.test(
      message
    )
  ) {
    return new RetryableError(message)
  }

  return new FatalError(message)
}

export async function scrapeHomepageStep(
  input: WorkflowState
): Promise<ScrapedHomepageState> {
  "use step"

  const startedAt = Date.now()

  await persistRunPhase({
    analysisId: input.analysisId,
    authToken: input.authToken,
    status: "scraping",
    warnings: input.warnings,
  })

  try {
    const homepageArtifact = await scrapeHomepageArtifact(input.website)

    return {
      ...input,
      homepageArtifact,
      timings: extendTimings(input.timings, "scrapeHomepageMs", startedAt),
    }
  } catch (error) {
    logStepError("Workflow homepage scrape failed", error, {
      analysisId: input.analysisId,
      website: input.website,
    })

    throw classifyScrapeError(error)
  }
}

scrapeHomepageStep.maxRetries = 1
