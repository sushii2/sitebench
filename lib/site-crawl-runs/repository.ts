import type { InsForgeClient } from "@insforge/sdk"

import {
  logOnboardingAnalysisError,
  logOnboardingAnalysisEvent,
  serializeOnboardingError,
} from "@/lib/onboarding/analysis-logging"
import { getOnboardingErrorMessage } from "@/lib/onboarding/analysis-logging"
import type {
  SiteCrawlRun,
  SiteCrawlRunStatus,
  SiteCrawlRunTriggerType,
} from "@/lib/site-crawl-runs/types"

type SiteCrawlRunClient = Pick<InsForgeClient, "database">

function normalizeSiteCrawlRunError(error: unknown, fallback: string) {
  const message = getOnboardingErrorMessage(error, fallback)

  if (/site_crawl_runs/i.test(message) && /does not exist|not found/i.test(message)) {
    return new Error(
      "The onboarding analysis tables are missing. Apply db/migrations/0004_onboarding_site_analysis.sql before using the crawl flow."
    )
  }

  return new Error(message)
}

function takeSingleRow<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

export async function createSiteCrawlRun(
  client: SiteCrawlRunClient,
  input: {
    analysisVersion?: number
    projectId: string
    triggerType?: SiteCrawlRunTriggerType
  }
): Promise<SiteCrawlRun> {
  const runId = crypto.randomUUID()
  const initialValues = {
    analysis_version: input.analysisVersion ?? 2,
    completed_at: null,
    error_message: null,
    firecrawl_job_ids: [],
    id: runId,
    project_id: input.projectId,
    result_json: null,
    selected_url_count: 0,
    started_at: new Date().toISOString(),
    status: "scraping" satisfies SiteCrawlRunStatus,
    trigger_type: input.triggerType ?? "onboarding",
    workflow_run_id: null,
    warnings: [],
  }

  const response = await client.database
    .from("site_crawl_runs")
    .insert([initialValues])
  const responseError = response ? "error" in response ? response.error : null : null
  const responseData = response ? "data" in response ? response.data : null : null

  if (!response || responseError) {
    logOnboardingAnalysisError("Crawl run insert failed", responseError, {
      projectId: input.projectId,
      response: response
        ? {
            data: responseData ?? null,
            error: serializeOnboardingError(responseError),
          }
        : null,
      runId,
    })

    throw normalizeSiteCrawlRunError(
      responseError,
      "Unable to create crawl run."
    )
  }

  logOnboardingAnalysisEvent("Crawl run insert completed", {
    projectId: input.projectId,
    response: {
      data: responseData ?? null,
      error: responseError ? serializeOnboardingError(responseError) : null,
    },
    runId,
  })

  logOnboardingAnalysisEvent("Crawl run insert returned no row, reloading by id", {
    projectId: input.projectId,
    runId,
  })

  const reloadedRun = await loadSiteCrawlRun(client, runId)

  if (!reloadedRun) {
    throw new Error(
      "Unable to create crawl run. Database insert returned no row and reload by id failed. This usually means the onboarding analysis migration is missing or row-level access is blocking the new table."
    )
  }

  return reloadedRun
}

export async function loadSiteCrawlRun(
  client: SiteCrawlRunClient,
  runId: string
): Promise<SiteCrawlRun | null> {
  const response = await client.database
    .from("site_crawl_runs")
    .select("*")
    .eq("id", runId)
    .maybeSingle()

  if (!response) {
    throw new Error("Unable to load crawl run.")
  }

  if (response.error) {
    throw normalizeSiteCrawlRunError(
      response.error,
      "Unable to load crawl run."
    )
  }

  return takeSingleRow(response.data as SiteCrawlRun | SiteCrawlRun[] | null)
}

export async function updateSiteCrawlRun(
  client: SiteCrawlRunClient,
  runId: string,
  values: Partial<
    Pick<
      SiteCrawlRun,
      | "completed_at"
      | "error_message"
      | "firecrawl_job_ids"
      | "result_json"
      | "selected_url_count"
      | "status"
      | "workflow_run_id"
      | "warnings"
    >
  >
): Promise<SiteCrawlRun> {
  const response = await client.database
    .from("site_crawl_runs")
    .update(values)
    .eq("id", runId)
    .select("*")
    .maybeSingle()

  if (!response || response.error || !response.data) {
    throw normalizeSiteCrawlRunError(
      response?.error,
      "Unable to update crawl run."
    )
  }

  const run = takeSingleRow(response.data as SiteCrawlRun | SiteCrawlRun[] | null)

  if (!run) {
    throw new Error("Unable to update crawl run.")
  }

  return run
}
