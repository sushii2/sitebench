import { normalizeWebsite } from "@/lib/brands"

import {
  extendTimings,
  normalizeWhitespace,
  persistRunPhase,
} from "@/workflows/onboarding-analysis/steps/shared"
import type {
  OnboardingAnalysisWorkflowInput,
  WorkflowState,
} from "@/workflows/onboarding-analysis/types"

export async function initializeRunStep(
  input: OnboardingAnalysisWorkflowInput
): Promise<WorkflowState> {
  "use step"

  const startedAt = Date.now()
  const website = normalizeWebsite(input.website)
  const companyName = normalizeWhitespace(input.companyName)

  await persistRunPhase({
    analysisId: input.analysisId,
    authToken: input.authToken,
    status: "scraping",
    warnings: [],
  })

  return {
    ...input,
    companyName,
    timings: extendTimings({}, "initializeRunMs", startedAt),
    warnings: [],
    website,
  }
}
