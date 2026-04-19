import { updateSiteCrawlRun } from "@/lib/site-crawl-runs/repository"

import {
  createWorkflowOnboardingClient,
  uniqueWarnings,
} from "@/workflows/onboarding-analysis/steps/shared"

export async function failRunStep(input: {
  analysisId: string
  authToken: string
  message: string
  warnings: string[]
}) {
  "use step"

  const client = createWorkflowOnboardingClient(input.authToken)
  const warnings = uniqueWarnings([...input.warnings, input.message])

  await updateSiteCrawlRun(client, input.analysisId, {
    completed_at: new Date().toISOString(),
    error_message: input.message,
    status: "failed",
    warnings,
  })

  return {
    analysisId: input.analysisId,
    status: "failed" as const,
    warnings,
  }
}
