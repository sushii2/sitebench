import type { InsForgeClient } from "@insforge/sdk"
import { getRun } from "workflow/api"

import { loadCurrentUserBrand } from "@/lib/brands"
import type { PromptRun } from "@/lib/prompt-runs/types"
import type { PromptRunResponse } from "@/lib/prompt-run-responses/types"
import type { ProjectTopic } from "@/lib/project-topics/types"
import type { ResponseBrandCitation } from "@/lib/response-brand-citations/types"
import type { ResponseBrandMetric } from "@/lib/response-brand-metrics/types"
import type { ResponseCitation } from "@/lib/response-citations/types"
import type { SourceDomain } from "@/lib/source-domains/types"
import type { SourcePage } from "@/lib/source-pages/types"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"
import {
  computeInitialPromptPipelineRunAt,
} from "@/lib/prompt-pipeline/schedule"
import type {
  PromptPipelineConfig,
  PromptPipelineConfigPrompt,
  PromptPipelineConfigScreenData,
  PromptPipelineFrequency,
  PromptPipelineRun,
  PromptPipelineRunTrace,
  PromptPipelineRunWithTrace,
  PromptPipelineWorkflowPrompt,
  PromptRunChatPayload,
  PromptRunChatProviderResponse,
  PromptRunChatRecentRun,
} from "@/lib/prompt-pipeline/types"
import type { BrandEntity } from "@/lib/brand-entities/types"
import type { PromptPipelineWorkflowRpcClient } from "@/lib/prompt-pipeline/workflow-rpc-client"

type PromptPipelineClient = Pick<InsForgeClient, "auth" | "database">
type PromptPipelineDatabaseClient = Pick<InsForgeClient, "database">
type PromptPipelineRpcClient = PromptPipelineWorkflowRpcClient

let promptPipelineTraceTableAvailable: boolean | null = null
let promptPipelineTraceTableWarningShown = false

interface ClaimedPromptPipelineConfig {
  config_id: string
  project_id: string
  frequency: PromptPipelineFrequency
  scheduled_for: string
}

interface BeginPromptPipelineRunResult {
  pipeline_run: PromptPipelineRun
  selected_prompts: PromptPipelineWorkflowPrompt[]
}

function takeRows<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

function takeSingleRow<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function toPromptPipelineRepositoryErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message
  }

  if (isRecord(error) && typeof error.message === "string") {
    return error.message
  }

  return null
}

function isMissingPromptPipelineTraceTableError(error: unknown) {
  const message = toPromptPipelineRepositoryErrorMessage(error)

  return Boolean(
    message &&
      /prompt_pipeline_run_traces|relation .*does not exist|column .*does not exist/i.test(
        message
      )
  )
}

function isMissingWorkflowRunError(error: unknown) {
  const message = toPromptPipelineRepositoryErrorMessage(error)

  return Boolean(
    message &&
      /not found|404|unknown .*run|missing .*run|no such .*run|workflow run .*does not exist/i.test(
        message
      )
  )
}

function isPromptPipelineRunActiveStatus(status: PromptPipelineRun["status"]) {
  return status === "queued" || status === "running"
}

async function resolveCurrentProjectId(client: PromptPipelineClient) {
  const brand = await loadCurrentUserBrand(client)

  if (!brand?.id) {
    throw new Error("You must complete onboarding before using the prompt pipeline.")
  }

  return brand.id
}

async function loadPromptPipelineConfigRecord(
  client: PromptPipelineDatabaseClient,
  projectId: string
) {
  const response = await client.database
    .from("prompt_pipeline_configs")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle()

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load the prompt pipeline config.")
  }

  return takeSingleRow(
    response.data as
      | Omit<PromptPipelineConfig, "selected_prompt_ids">
      | Array<Omit<PromptPipelineConfig, "selected_prompt_ids">>
      | null
  )
}

async function loadPromptPipelineConfigPromptRows(
  client: PromptPipelineDatabaseClient,
  configId: string
) {
  const response = await client.database
    .from("prompt_pipeline_config_prompts")
    .select("*")
    .eq("config_id", configId)

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load prompt selections.")
  }

  return takeRows(
    response.data as
      | PromptPipelineConfigPrompt
      | PromptPipelineConfigPrompt[]
      | null
  )
}

export async function loadPromptPipelineConfigByProject(
  client: PromptPipelineDatabaseClient,
  projectId: string
): Promise<PromptPipelineConfig | null> {
  const config = await loadPromptPipelineConfigRecord(client, projectId)

  if (!config) {
    return null
  }

  const selectedPromptIds = (
    await loadPromptPipelineConfigPromptRows(client, config.id)
  ).map((row) => row.tracked_prompt_id)

  return {
    ...config,
    selected_prompt_ids: selectedPromptIds,
  }
}

export async function loadLatestPromptPipelineRun(
  client: PromptPipelineDatabaseClient,
  configId: string
) {
  const response = await client.database
    .from("prompt_pipeline_runs")
    .select("*")
    .eq("config_id", configId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load the latest pipeline run.")
  }

  return takeSingleRow(response.data as PromptPipelineRun | PromptPipelineRun[] | null)
}

export async function loadPromptPipelineRunTraceRows(
  client: PromptPipelineDatabaseClient,
  pipelineRunId: string
) {
  if (promptPipelineTraceTableAvailable === false) {
    return []
  }

  const response = await client.database
    .from("prompt_pipeline_run_traces")
    .select("*")
    .eq("pipeline_run_id", pipelineRunId)
    .order("created_at", { ascending: true })

  if (!response || response.error) {
    if (isMissingPromptPipelineTraceTableError(response?.error)) {
      if (!promptPipelineTraceTableWarningShown) {
        console.warn(
          "[prompt-pipeline] Trace table unavailable while loading config."
        )
        promptPipelineTraceTableWarningShown = true
      }

      promptPipelineTraceTableAvailable = false

      return []
    }

    throw response?.error ?? new Error("Unable to load the prompt pipeline run trace.")
  }

  promptPipelineTraceTableAvailable = true

  return takeRows(
    response.data as PromptPipelineRunTrace | PromptPipelineRunTrace[] | null
  )
}

export async function loadActivePromptPipelineRun(
  client: PromptPipelineDatabaseClient,
  configId: string
) {
  const response = await client.database
    .from("prompt_pipeline_runs")
    .select("*")
    .eq("config_id", configId)
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load the active pipeline run.")
  }

  return takeSingleRow(response.data as PromptPipelineRun | PromptPipelineRun[] | null)
}

async function loadPromptPipelineRunById(
  client: PromptPipelineDatabaseClient,
  pipelineRunId: string
) {
  const response = await client.database
    .from("prompt_pipeline_runs")
    .select("*")
    .eq("id", pipelineRunId)
    .maybeSingle()

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load the pipeline run.")
  }

  return takeSingleRow(response.data as PromptPipelineRun | PromptPipelineRun[] | null)
}

export async function recordPromptPipelineRunTrace(
  client: PromptPipelineRpcClient,
  input: {
    detailJson?: Record<string, unknown> | null
    message: string
    pipelineRunId: string
    status: PromptPipelineRunTrace["status"]
    stepKey: string
  }
) {
  const response = await client.database.rpc("record_prompt_pipeline_run_trace", {
    detail_json: input.detailJson ?? {},
    message: input.message,
    pipeline_run_id: input.pipelineRunId,
    status: input.status,
    step_key: input.stepKey,
  })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to record the prompt pipeline trace.")
  }
}

export async function cancelPromptPipelineRunRecord(
  client: PromptPipelineRpcClient,
  input: {
    failureReason?: string | null
    pipelineRunId: string
  }
) {
  const response = await client.database.rpc("cancel_prompt_pipeline_run", {
    failure_reason: input.failureReason ?? null,
    pipeline_run_id: input.pipelineRunId,
  })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to cancel the prompt pipeline run.")
  }
}

export async function terminatePromptPipelineRunRecord(
  client: PromptPipelineRpcClient,
  pipelineRunId: string
) {
  const response = await client.database.rpc("terminate_prompt_pipeline_run", {
    pipeline_run_id: pipelineRunId,
  })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to terminate the prompt pipeline run.")
  }
}

async function reconcilePromptPipelineRun(
  client: PromptPipelineDatabaseClient,
  run: PromptPipelineRun | null
): Promise<PromptPipelineRun | null> {
  if (!run || !isPromptPipelineRunActiveStatus(run.status) || !run.workflow_run_id) {
    return run
  }

  try {
    const workflowRun = getRun(run.workflow_run_id)
    const workflowExists = await workflowRun.exists

    if (!workflowExists) {
      const failureReason = "Workflow was stopped before completion."

      await cancelPromptPipelineRunRecord(client as PromptPipelineRpcClient, {
        failureReason,
        pipelineRunId: run.id,
      })

      return loadPromptPipelineRunById(client, run.id)
    }

    const workflowStatus = await workflowRun.status

    if (workflowStatus === "pending" || workflowStatus === "running") {
      if (workflowStatus === "running" && run.status !== "running") {
        const runningRun: PromptPipelineRun = {
          ...run,
          status: "running",
        }

        return runningRun
      }

      return run
    }

    if (workflowStatus === "cancelled") {
      const failureReason = "Workflow was stopped before completion."

      await cancelPromptPipelineRunRecord(client as PromptPipelineRpcClient, {
        failureReason,
        pipelineRunId: run.id,
      })

      return loadPromptPipelineRunById(client, run.id)
    }

    if (workflowStatus === "completed") {
      await finalizePromptPipelineRunRecord(client as PromptPipelineRpcClient, {
        pipelineRunId: run.id,
        status: "completed",
      })

      return loadPromptPipelineRunById(client, run.id)
    }

    const failureReason = "Workflow failed before the pipeline run finalized."

    await finalizePromptPipelineRunRecord(client as PromptPipelineRpcClient, {
      failureReason,
      pipelineRunId: run.id,
      status: "failed",
    })

    return loadPromptPipelineRunById(client, run.id)
  } catch (error) {
    if (isMissingWorkflowRunError(error)) {
      const failureReason = "Workflow was stopped before completion."

      try {
        await cancelPromptPipelineRunRecord(client as PromptPipelineRpcClient, {
          failureReason,
          pipelineRunId: run.id,
        })

        return await loadPromptPipelineRunById(client, run.id)
      } catch (finalizeError) {
        console.error(
          "[prompt-pipeline] Unable to finalize orphaned pipeline run during reconciliation",
          {
            message:
              finalizeError instanceof Error
                ? finalizeError.message
                : "Unknown error",
            pipelineRunId: run.id,
            workflowRunId: run.workflow_run_id,
          }
        )
      }
    }

    console.error("[prompt-pipeline] Unable to reconcile workflow run state", {
      message: error instanceof Error ? error.message : "Unknown error",
      pipelineRunId: run.id,
      workflowRunId: run.workflow_run_id,
    })

    return run
  }
}

export async function loadPromptPipelineConfigScreen(
  client: PromptPipelineClient
): Promise<PromptPipelineConfigScreenData> {
  const projectId = await resolveCurrentProjectId(client)
  const [projectResponse, activeTopicsResponse, activePromptsResponse, config] =
    await Promise.all([
    client.database
      .from("tracking_projects")
      .select("reporting_timezone")
      .eq("id", projectId)
      .maybeSingle(),
    client.database
      .from("project_topics")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    client.database
      .from("tracked_prompts")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .order("created_at", { ascending: true }),
    loadPromptPipelineConfigByProject(client, projectId),
    ])

  if (!projectResponse || projectResponse.error) {
    throw (
      projectResponse?.error ??
      new Error("Unable to load the project timezone for the prompt pipeline.")
    )
  }

  if (!activeTopicsResponse || activeTopicsResponse.error) {
    throw (
      activeTopicsResponse?.error ??
      new Error("Unable to load active topics for the prompt pipeline.")
    )
  }

  if (!activePromptsResponse || activePromptsResponse.error) {
    throw (
      activePromptsResponse?.error ??
      new Error("Unable to load active prompts for the prompt pipeline.")
    )
  }

  const activeTopics = takeRows(
    activeTopicsResponse.data as ProjectTopic | ProjectTopic[] | null
  )
  const activePrompts = takeRows(
    activePromptsResponse.data as TrackedPrompt | TrackedPrompt[] | null
  )
  const latestRun = config
    ? await reconcilePromptPipelineRun(
      client,
      await loadLatestPromptPipelineRun(client, config.id)
    )
    : null
  const latestRunTraces = latestRun
    ? await loadPromptPipelineRunTraceRows(client, latestRun.id)
    : []

  return {
    activePrompts,
    activeTopics,
    config,
    hasActiveRun: Boolean(latestRun && isPromptPipelineRunActiveStatus(latestRun.status)),
    latestRun: latestRun
      ? ({
        ...latestRun,
        traces: latestRunTraces,
      } satisfies PromptPipelineRunWithTrace)
      : null,
    reportingTimezone:
      takeSingleRow(
        projectResponse.data as
          | { reporting_timezone?: string }
          | Array<{ reporting_timezone?: string }>
          | null
      )?.reporting_timezone ?? "UTC",
  }
}

export async function savePromptPipelineConfigForProject(
  client: PromptPipelineClient,
  input: {
    frequency: PromptPipelineFrequency
    selectedPromptIds: string[]
  },
  authorization?: string | null
) {
  void authorization

  if (input.selectedPromptIds.length === 0) {
    throw new Error("At least one prompt must be selected.")
  }

  const projectId = await resolveCurrentProjectId(client)
  const now = new Date().toISOString()
  const [projectResponse, existingConfig, promptRowsResponse] = await Promise.all([
    client.database
      .from("tracking_projects")
      .select("reporting_timezone")
      .eq("id", projectId)
      .maybeSingle(),
    loadPromptPipelineConfigRecord(client, projectId),
    client.database
      .from("tracked_prompts")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_active", true)
      .in("id", input.selectedPromptIds),
  ])

  if (!promptRowsResponse || promptRowsResponse.error) {
    throw (
      promptRowsResponse?.error ?? new Error("Unable to validate prompt selections.")
    )
  }

  if (!projectResponse || projectResponse.error) {
    throw (
      projectResponse?.error ??
      new Error("Unable to load the project timezone for the prompt pipeline.")
    )
  }

  const validPromptIds = new Set(
    takeRows(promptRowsResponse.data as TrackedPrompt | TrackedPrompt[] | null).map(
      (prompt) => prompt.id
    )
  )

  if (validPromptIds.size !== input.selectedPromptIds.length) {
    throw new Error("One or more selected prompts are no longer active.")
  }

  const anchorTimezone =
    takeSingleRow(
      projectResponse.data as
        | { reporting_timezone?: string }
        | Array<{ reporting_timezone?: string }>
        | null
    )?.reporting_timezone ?? "UTC"
  const nextRunAt = computeInitialPromptPipelineRunAt(now, input.frequency)
  let configId = existingConfig?.id ?? null

  if (existingConfig) {
    const updateResponse = await client.database
      .from("prompt_pipeline_configs")
      .update({
        anchor_timezone: anchorTimezone,
        frequency: input.frequency,
        is_enabled: true,
        next_run_at: nextRunAt,
      })
      .eq("id", existingConfig.id)
      .select("*")
      .maybeSingle()

    if (!updateResponse || updateResponse.error || !updateResponse.data) {
      throw updateResponse?.error ?? new Error("Unable to update the prompt pipeline config.")
    }

    configId = takeSingleRow(
      updateResponse.data as
        | Omit<PromptPipelineConfig, "selected_prompt_ids">
        | Array<Omit<PromptPipelineConfig, "selected_prompt_ids">>
        | null
    )?.id ?? null
  } else {
    const insertResponse = await client.database
      .from("prompt_pipeline_configs")
      .insert([
        {
          anchor_timezone: anchorTimezone,
          frequency: input.frequency,
          is_enabled: true,
          last_failure_message: null,
          last_pipeline_run_id: null,
          last_run_at: null,
          last_run_status: null,
          next_run_at: nextRunAt,
          project_id: projectId,
        },
      ])
      .select("*")
      .maybeSingle()

    if (!insertResponse || insertResponse.error || !insertResponse.data) {
      throw insertResponse?.error ?? new Error("Unable to create the prompt pipeline config.")
    }

    configId = takeSingleRow(
      insertResponse.data as
        | Omit<PromptPipelineConfig, "selected_prompt_ids">
        | Array<Omit<PromptPipelineConfig, "selected_prompt_ids">>
        | null
    )?.id ?? null
  }

  if (!configId) {
    throw new Error("Unable to persist the prompt pipeline config.")
  }

  await client.database
    .from("prompt_pipeline_config_prompts")
    .delete()
    .eq("config_id", configId)

  const insertSelectionResponse = await client.database
    .from("prompt_pipeline_config_prompts")
    .insert(
      input.selectedPromptIds.map((trackedPromptId) => ({
        config_id: configId,
        tracked_prompt_id: trackedPromptId,
      }))
    )
    .select("*")

  if (!insertSelectionResponse || insertSelectionResponse.error) {
    throw (
      insertSelectionResponse?.error ??
      new Error("Unable to save the selected prompts for the pipeline.")
    )
  }

  return loadPromptPipelineConfigScreen(client)
}

export async function claimDuePromptPipelineConfigs(
  client: PromptPipelineDatabaseClient,
  limit: number
) {
  const response = await client.database.rpc(
    "claim_due_prompt_pipeline_configs",
    {
      current_timestamp_value: new Date().toISOString(),
      limit_count: limit,
    }
  )

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to claim due pipeline configs.")
  }

  return takeRows(
    response.data as
      | ClaimedPromptPipelineConfig
      | ClaimedPromptPipelineConfig[]
      | null
  )
}

export async function beginPromptPipelineRun(
  client: PromptPipelineRpcClient,
  input: {
    configId: string
    pipelineRunId: string
    projectId: string
    requestId: string
    scheduledFor: string
    triggerType: "manual" | "scheduled"
    workflowRunId?: string | null
  }
) {
  const response = await client.database.rpc("begin_prompt_pipeline_run", {
    config_id: input.configId,
    pipeline_run_id: input.pipelineRunId,
    project_id: input.projectId,
    request_id: input.requestId,
    scheduled_for: input.scheduledFor,
    trigger_type: input.triggerType,
    workflow_run_id: input.workflowRunId ?? null,
  })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to initialize the pipeline run.")
  }

  const payload = takeSingleRow(
    response.data as
      | BeginPromptPipelineRunResult
      | BeginPromptPipelineRunResult[]
      | null
  )

  if (!payload) {
    throw new Error("Unable to initialize the pipeline run.")
  }

  return payload
}

export async function recordPromptPlatformResult(
  client: PromptPipelineRpcClient,
  input: {
    inputTokens: number | null
    latencyMs: number | null
    outputTokens: number | null
    parsedBrands: unknown
    parsedCitations: unknown
    parserWarnings: string[]
    platformCode: string
    promptRunId: string
    providerModel: string | null
    rawResponseJson: Record<string, unknown> | null
    rawResponseText: string | null
    status: string
    errorCode?: string | null
    errorMessage?: string | null
  }
) {
  const response = await client.database.rpc("record_prompt_platform_result", {
    error_code: input.errorCode ?? null,
    error_message: input.errorMessage ?? null,
    input_tokens: input.inputTokens,
    latency_ms: input.latencyMs,
    output_tokens: input.outputTokens,
    parsed_brands_json: input.parsedBrands,
    parsed_citations_json: input.parsedCitations,
    parser_warnings: input.parserWarnings,
    platform_code: input.platformCode,
    prompt_run_id: input.promptRunId,
    provider_model: input.providerModel,
    raw_response_json: input.rawResponseJson,
    raw_response_text: input.rawResponseText,
    status: input.status,
  })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to persist the platform result.")
  }
}

export async function finalizePromptRunRecord(
  client: PromptPipelineRpcClient,
  promptRunId: string
) {
  const response = await client.database.rpc("finalize_prompt_run", {
    prompt_run_id: promptRunId,
  })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to finalize the prompt run.")
  }
}

export async function finalizePromptPipelineRunRecord(
  client: PromptPipelineRpcClient,
  input: {
    pipelineRunId: string
    failureReason?: string | null
    status: PromptPipelineRun["status"]
  }
) {
  const response = await client.database.rpc("finalize_prompt_pipeline_run", {
    failure_reason: input.failureReason ?? null,
    pipeline_run_id: input.pipelineRunId,
    status: input.status,
  })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to finalize the pipeline run.")
  }
}

export async function resolveBlockingPromptPipelineRun(
  client: PromptPipelineDatabaseClient,
  configId: string
) {
  return reconcilePromptPipelineRun(
    client,
    await loadActivePromptPipelineRun(client, configId)
  )
}

export async function loadPromptRunChatPayload(
  client: PromptPipelineClient,
  promptRunId: string
): Promise<PromptRunChatPayload | null> {
  const promptRunResponse = await client.database
    .from("prompt_runs")
    .select("*")
    .eq("id", promptRunId)
    .maybeSingle()

  if (!promptRunResponse || promptRunResponse.error) {
    throw promptRunResponse?.error ?? new Error("Unable to load the prompt run.")
  }

  const promptRun = takeSingleRow(
    promptRunResponse.data as PromptRun | PromptRun[] | null
  )

  if (!promptRun) {
    return null
  }

  const [
    trackedPromptResponse,
    topicResponse,
    responsesResponse,
    recentPromptRunsResponse,
  ] = await Promise.all([
    client.database
      .from("tracked_prompts")
      .select("*")
      .eq("id", promptRun.tracked_prompt_id)
      .maybeSingle(),
    client.database
      .from("project_topics")
      .select("*")
      .eq("id", promptRun.project_topic_id)
      .maybeSingle(),
    client.database
      .from("prompt_run_responses")
      .select("*")
      .eq("prompt_run_id", promptRunId)
      .order("platform_code", { ascending: true }),
    client.database
      .from("prompt_runs")
      .select("*")
      .eq("project_id", promptRun.project_id)
      .order("created_at", { ascending: false })
      .limit(10),
  ])

  if (!trackedPromptResponse || trackedPromptResponse.error) {
    throw trackedPromptResponse?.error ?? new Error("Unable to load the tracked prompt.")
  }

  if (!topicResponse || topicResponse.error) {
    throw topicResponse?.error ?? new Error("Unable to load the prompt topic.")
  }

  if (!responsesResponse || responsesResponse.error) {
    throw responsesResponse?.error ?? new Error("Unable to load prompt responses.")
  }

  if (!recentPromptRunsResponse || recentPromptRunsResponse.error) {
    throw recentPromptRunsResponse?.error ?? new Error("Unable to load recent prompt runs.")
  }

  const trackedPrompt = takeSingleRow(
    trackedPromptResponse.data as TrackedPrompt | TrackedPrompt[] | null
  )
  const topic = takeSingleRow(topicResponse.data as ProjectTopic | ProjectTopic[] | null)
  const responses = takeRows(
    responsesResponse.data as PromptRunResponse | PromptRunResponse[] | null
  )
  const recentPromptRuns = takeRows(
    recentPromptRunsResponse.data as PromptRun | PromptRun[] | null
  )

  const responseIds = responses.map((response) => response.id)
  const recentTrackedPromptIds = [
    ...new Set(recentPromptRuns.map((run) => run.tracked_prompt_id)),
  ]
  const recentTopicIds = [...new Set(recentPromptRuns.map((run) => run.project_topic_id))]

  const [
    citationsResponse,
    brandMetricsResponse,
    recentTrackedPromptsResponse,
    recentTopicsResponse,
  ] = await Promise.all([
    responseIds.length > 0
      ? client.database
          .from("response_citations")
          .select("*")
          .in("response_id", responseIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),
    responseIds.length > 0
      ? client.database
          .from("response_brand_metrics")
          .select("*")
          .in("response_id", responseIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),
    recentTrackedPromptIds.length > 0
      ? client.database
          .from("tracked_prompts")
          .select("*")
          .in("id", recentTrackedPromptIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),
    recentTopicIds.length > 0
      ? client.database
          .from("project_topics")
          .select("*")
          .in("id", recentTopicIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ])

  if (!citationsResponse || citationsResponse.error) {
    throw citationsResponse?.error ?? new Error("Unable to load prompt citations.")
  }

  if (!brandMetricsResponse || brandMetricsResponse.error) {
    throw brandMetricsResponse?.error ?? new Error("Unable to load brand metrics.")
  }

  if (!recentTrackedPromptsResponse || recentTrackedPromptsResponse.error) {
    throw (
      recentTrackedPromptsResponse?.error ??
      new Error("Unable to load recent tracked prompts.")
    )
  }

  if (!recentTopicsResponse || recentTopicsResponse.error) {
    throw recentTopicsResponse?.error ?? new Error("Unable to load recent topics.")
  }

  const citations = takeRows(
    citationsResponse.data as ResponseCitation | ResponseCitation[] | null
  )
  const brandMetrics = takeRows(
    brandMetricsResponse.data as ResponseBrandMetric | ResponseBrandMetric[] | null
  )
  const recentTrackedPrompts = takeRows(
    recentTrackedPromptsResponse.data as TrackedPrompt | TrackedPrompt[] | null
  )
  const recentTopics = takeRows(
    recentTopicsResponse.data as ProjectTopic | ProjectTopic[] | null
  )

  const sourcePageIds = [...new Set(citations.map((citation) => citation.source_page_id))]
  const brandEntityIds = [...new Set(brandMetrics.map((metric) => metric.brand_entity_id))]

  const [
    sourcePagesResponse,
    brandEntitiesResponse,
    brandCitationLinksResponse,
  ] = await Promise.all([
    sourcePageIds.length > 0
      ? client.database.from("source_pages").select("*").in("id", sourcePageIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),
    brandEntityIds.length > 0
      ? client.database.from("brand_entities").select("*").in("id", brandEntityIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),
    brandMetrics.length > 0
      ? client.database
          .from("response_brand_citations")
          .select("*")
          .in(
            "response_brand_metric_id",
            brandMetrics.map((metric) => metric.id)
          )
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ])

  if (!sourcePagesResponse || sourcePagesResponse.error) {
    throw sourcePagesResponse?.error ?? new Error("Unable to load source pages.")
  }

  if (!brandEntitiesResponse || brandEntitiesResponse.error) {
    throw brandEntitiesResponse?.error ?? new Error("Unable to load cited brands.")
  }

  if (!brandCitationLinksResponse || brandCitationLinksResponse.error) {
    throw (
      brandCitationLinksResponse?.error ??
      new Error("Unable to load brand citation links.")
    )
  }

  const sourcePages = takeRows(
    sourcePagesResponse.data as SourcePage | SourcePage[] | null
  )
  const brandEntities = takeRows(
    brandEntitiesResponse.data as BrandEntity | BrandEntity[] | null
  )
  const brandCitationLinks = takeRows(
    brandCitationLinksResponse.data as
      | ResponseBrandCitation
      | ResponseBrandCitation[]
      | null
  )
  const domainIds = [...new Set(sourcePages.map((page) => page.domain_id))]

  const sourceDomainsResponse =
    domainIds.length > 0
      ? await client.database.from("source_domains").select("*").in("id", domainIds)
      : {
          data: [],
          error: null,
        }

  if (!sourceDomainsResponse || sourceDomainsResponse.error) {
    throw sourceDomainsResponse?.error ?? new Error("Unable to load source domains.")
  }

  const sourceDomains = takeRows(
    sourceDomainsResponse.data as SourceDomain | SourceDomain[] | null
  )

  const sourcePageById = new Map(sourcePages.map((page) => [page.id, page]))
  const sourceDomainById = new Map(
    sourceDomains.map((domain) => [domain.id, domain])
  )
  const brandEntityById = new Map(
    brandEntities.map((brandEntity) => [brandEntity.id, brandEntity])
  )
  const citationByResponseId = new Map<string, ResponseCitation[]>()
  const brandMetricByResponseId = new Map<string, ResponseBrandMetric[]>()

  for (const citation of citations) {
    const list = citationByResponseId.get(citation.response_id) ?? []

    list.push(citation)
    citationByResponseId.set(citation.response_id, list)
  }

  for (const metric of brandMetrics) {
    const list = brandMetricByResponseId.get(metric.response_id) ?? []

    list.push(metric)
    brandMetricByResponseId.set(metric.response_id, list)
  }

  const citationCountByMetricId = new Map<string, number>()

  for (const link of brandCitationLinks) {
    citationCountByMetricId.set(
      link.response_brand_metric_id,
      (citationCountByMetricId.get(link.response_brand_metric_id) ?? 0) + 1
    )
  }

  const providerResponses: PromptRunChatProviderResponse[] = responses.map(
    (response) => ({
      brands: (brandMetricByResponseId.get(response.id) ?? []).map((metric) => ({
        citationCount: citationCountByMetricId.get(metric.id) ?? 0,
        id: metric.brand_entity_id,
        name: brandEntityById.get(metric.brand_entity_id)?.name ?? "Unknown",
        recommendationStatus: metric.recommendation_status,
        sentimentLabel: metric.sentiment_label,
        visibilityScore: Number(metric.visibility_score),
      })),
      citations: (citationByResponseId.get(response.id) ?? []).map((citation) => {
        const page = sourcePageById.get(citation.source_page_id)
        const domain = page ? sourceDomainById.get(page.domain_id) : null

        return {
          citationText: citation.citation_text,
          id: citation.id,
          pageTitle:
            page?.page_title ??
            domain?.display_name ??
            domain?.domain ??
            null,
          url: citation.cited_url,
        }
      }),
      errorMessage: response.error_message,
      platformCode: response.platform_code,
      rawResponseJson: isRecord(response.raw_response_json)
        ? response.raw_response_json
        : null,
      rawResponseText: response.raw_response_text,
    })
  )

  const recentTrackedPromptById = new Map(
    recentTrackedPrompts.map((recentTrackedPrompt) => [
      recentTrackedPrompt.id,
      recentTrackedPrompt,
    ])
  )
  const recentTopicById = new Map(
    recentTopics.map((recentProjectTopic) => [recentProjectTopic.id, recentProjectTopic])
  )
  const recentRuns: PromptRunChatRecentRun[] = recentPromptRuns.map((run) => ({
    id: run.id,
    promptText:
      recentTrackedPromptById.get(run.tracked_prompt_id)?.prompt_text ??
      "Untitled prompt",
    ranAt: run.completed_at ?? run.created_at,
    status: run.status,
    topicName:
      recentTopicById.get(run.project_topic_id)?.name ?? "Untitled topic",
  }))

  return {
    promptRun,
    providerResponses,
    recentPromptRuns: recentRuns,
    topicName: topic?.name ?? "Untitled topic",
    trackedPromptText: trackedPrompt?.prompt_text ?? "Untitled prompt",
  }
}
