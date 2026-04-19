import type { InsForgeClient } from "@insforge/sdk"
import { start } from "workflow/api"

import {
  logOnboardingAnalysisError,
  logOnboardingAnalysisEvent,
} from "@/lib/onboarding/analysis-logging"
import { extractBearerToken } from "@/lib/onboarding/auth"
import {
  onboardingAnalysisResultSchema,
  onboardingAnalysisStartResponseSchema,
  onboardingAnalysisStatusResponseSchema,
  type OnboardingAnalysisRequest,
} from "@/lib/onboarding/types"
import {
  createSiteCrawlRun,
  loadSiteCrawlRun,
  updateSiteCrawlRun,
} from "@/lib/site-crawl-runs/repository"
import {
  type SiteCrawlRun,
  type SiteCrawlRunStatus,
} from "@/lib/site-crawl-runs/types"
import {
  onboardingAnalysisWorkflow,
  type OnboardingAnalysisWorkflowInput,
} from "@/workflows/onboarding-analysis"

export const ONBOARDING_ANALYSIS_VERSION = 2

type OnboardingAnalysisClient = Pick<InsForgeClient, "auth" | "database">

function uniqueWarnings(warnings: string[]) {
  return [...new Set(warnings.map((warning) => warning.trim()).filter(Boolean))]
}

function toErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "Unable to start onboarding analysis."
}

function toStatusResponse(run: SiteCrawlRun) {
  const warnings = uniqueWarnings([
    ...run.warnings,
    ...(run.error_message ? [run.error_message] : []),
  ])
  const base = {
    analysisId: run.id,
    status: run.status satisfies SiteCrawlRunStatus,
    warnings,
  }

  if (!run.result_json) {
    return onboardingAnalysisStatusResponseSchema.parse(base)
  }

  return onboardingAnalysisStatusResponseSchema.parse({
    ...base,
    result: onboardingAnalysisResultSchema.parse(run.result_json),
  })
}

export async function startOnboardingAnalysisRun(
  client: OnboardingAnalysisClient,
  input: OnboardingAnalysisRequest,
  authorization: string | null
) {
  const authToken = extractBearerToken(authorization)

  if (!authToken) {
    throw new Error("You must be signed in to continue.")
  }

  const run = await createSiteCrawlRun(client, {
    analysisVersion: ONBOARDING_ANALYSIS_VERSION,
    projectId: input.projectId,
  })

  try {
    const workflowInput: OnboardingAnalysisWorkflowInput = {
      analysisId: run.id,
      analysisVersion: ONBOARDING_ANALYSIS_VERSION,
      authToken,
      companyName: input.companyName,
      projectId: input.projectId,
      website: input.website,
    }
    const workflowRun = await start(onboardingAnalysisWorkflow, [workflowInput])

    const updatedRun = await updateSiteCrawlRun(client, run.id, {
      status: "mapping",
      workflow_run_id: workflowRun.runId,
      warnings: [],
    })

    logOnboardingAnalysisEvent("Analysis workflow enqueued", {
      analysisId: updatedRun.id,
      workflowRunId: workflowRun.runId,
    })

    return onboardingAnalysisStartResponseSchema.parse({
      analysisId: updatedRun.id,
      status: updatedRun.status,
      warnings: updatedRun.warnings,
    })
  } catch (error) {
    const message = toErrorMessage(error)

    await updateSiteCrawlRun(client, run.id, {
      completed_at: new Date().toISOString(),
      error_message: message,
      status: "failed",
      warnings: [message],
    }).catch((updateError) => {
      logOnboardingAnalysisError(
        "Failed to persist workflow enqueue failure",
        updateError,
        {
          analysisId: run.id,
        }
      )
    })

    throw error
  }
}

export async function loadOnboardingAnalysisRunStatus(
  client: OnboardingAnalysisClient,
  analysisId: string
) {
  logOnboardingAnalysisEvent("Analysis poll requested", {
    analysisId,
  })

  const run = await loadSiteCrawlRun(client, analysisId)

  if (!run) {
    throw new Error("Analysis not found.")
  }

  return toStatusResponse(run)
}
