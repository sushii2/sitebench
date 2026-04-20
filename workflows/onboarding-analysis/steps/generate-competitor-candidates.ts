import { generateCompetitorCandidates } from "@/lib/onboarding/competitor-candidates"

import {
  extendTimings,
  logStepError,
  persistRunPhase,
  toErrorWarning,
  uniqueWarnings,
} from "@/workflows/onboarding-analysis/steps/shared"
import type {
  CompetitorState,
  ProfiledState,
} from "@/workflows/onboarding-analysis/types"

export async function generateCompetitorCandidatesStep(
  input: ProfiledState
): Promise<CompetitorState> {
  "use step"

  const startedAt = Date.now()
  let warnings = [...input.warnings]
  let competitors: Array<{ name: string; website: string }> = []

  try {
    competitors = await generateCompetitorCandidates({
      brandProfile: input.brandProfile,
      companyName: input.companyName,
      website: input.website,
    })
  } catch (error) {
    warnings = uniqueWarnings([
      ...warnings,
      toErrorWarning(
        "We could not fully expand competitor candidates, so review competitors manually.",
        error
      ),
    ])
    logStepError("Workflow competitor-candidate generation failed", error, {
      analysisId: input.analysisId,
      website: input.website,
    })
  }

  await persistRunPhase({
    analysisId: input.analysisId,
    authToken: input.authToken,
    status: "competitors",
    warnings,
  })

  return {
    ...input,
    competitors,
    timings: extendTimings(input.timings, "generateCompetitorsMs", startedAt),
    warnings,
  }
}
