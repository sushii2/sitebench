import { updateSiteCrawlRun } from "@/lib/site-crawl-runs/repository"

import {
  createWorkflowOnboardingClient,
  extendTimings,
  uniqueWarnings,
} from "@/workflows/onboarding-analysis/steps/shared"
import type {
  PromptedState,
} from "@/workflows/onboarding-analysis/types"

export async function finalizeRunStep(input: PromptedState) {
  "use step"

  const startedAt = Date.now()
  const client = createWorkflowOnboardingClient(input.authToken)
  const timings = extendTimings(input.timings, "finalizeRunMs", startedAt)
  const warnings = uniqueWarnings(input.result.warnings)

  await updateSiteCrawlRun(client, input.analysisId, {
    completed_at: new Date().toISOString(),
    error_message: null,
    result_json: {
      ...input.result,
      metadata: {
        summaries: {
          competitorCount: input.competitors.length,
          selectedPageCount: 1,
          topicCount: input.topics.length,
        },
        timings,
      },
    },
    selected_url_count: 1,
    status: "completed",
    warnings,
  })

  return {
    ...input.result,
    warnings,
  }
}
