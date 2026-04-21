import { AbortTaskRunError, idempotencyKeys, logger, metadata, tags, task } from "@trigger.dev/sdk"

import { createInsforgeServiceClient } from "@/lib/insforge/service-client"
import { loadPromptRunConfig, updatePromptRunConfigRuntimeState } from "@/lib/prompt-run-configs/repository"
import type { PromptRunConfig } from "@/lib/prompt-run-configs/types"
import type { BrandEntity } from "@/lib/brand-entities/types"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"
import { analyzeResponses } from "@/src/trigger/prompt-runs/analyze-responses"
import {
  executeSingleProviderPrompt,
  promptRunProviderQueues,
} from "@/src/trigger/prompt-runs/execute-single-provider-prompt"
import { persistResults } from "@/src/trigger/prompt-runs/persist-results"
import type { TrackingProject } from "@/lib/tracking-projects/types"
import {
  calculateNextPromptRunAt,
  type ConfiguredPromptRunPayload,
  type ProviderExecutionPayload,
} from "@/src/trigger/prompt-runs/shared"

function takeRows<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

async function loadTrackingProject(projectId: string) {
  const client = createInsforgeServiceClient()
  const response = await client.database
    .from("tracking_projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle()

  if (!response || response.error || !response.data) {
    throw response?.error ?? new Error("Unable to load tracking project.")
  }

  return response.data as TrackingProject
}

async function loadBrands(projectId: string) {
  const client = createInsforgeServiceClient()
  const response = await client.database
    .from("brand_entities")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load brand entities.")
  }

  return takeRows(response.data as BrandEntity[] | BrandEntity | null)
}

async function loadTrackedPrompts(projectId: string, config: PromptRunConfig) {
  const client = createInsforgeServiceClient()
  const response = await client.database
    .from("tracked_prompts")
    .select("*")
    .eq("project_id", projectId)
    .in("id", config.selected_tracked_prompt_ids)

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load tracked prompts.")
  }

  return takeRows(response.data as TrackedPrompt[] | TrackedPrompt | null).filter(
    (prompt) => prompt.is_active
  )
}

function buildExecutionPlan(
  config: PromptRunConfig,
  trackedPrompts: TrackedPrompt[]
): ProviderExecutionPayload[] {
  return trackedPrompts.flatMap((trackedPrompt) =>
    config.enabled_providers.map((providerId) => ({
      projectId: trackedPrompt.project_id,
      projectTopicId: trackedPrompt.project_topic_id,
      promptText: trackedPrompt.prompt_text,
      providerId,
      trackedPromptId: trackedPrompt.id,
    }))
  )
}

function getProviderQueueName(
  providerId: ProviderExecutionPayload["providerId"]
) {
  return promptRunProviderQueues[providerId].name
}

export const runConfiguredPrompts = task({
  id: "prompt-runs.run-configured",
  maxDuration: 1_800,
  onFailure: async ({ payload }: { payload: ConfiguredPromptRunPayload }) => {
    try {
      const serviceClient = createInsforgeServiceClient()

      await updatePromptRunConfigRuntimeState(serviceClient, payload.projectId, {
        claimedAt: null,
        currentRunId: null,
      })
    } catch (cleanupError) {
      logger.error("[prompt-runs] onFailure claim cleanup failed", {
        error: cleanupError instanceof Error ? cleanupError.message : cleanupError,
        projectId: payload.projectId,
      })
    }
  },
  queue: {
    concurrencyLimit: 5,
    name: "prompt-runs-orchestrator",
  },
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: ConfiguredPromptRunPayload, { ctx }) => {
    const startedAt = new Date().toISOString()
    const serviceClient = createInsforgeServiceClient()
    const config = await loadPromptRunConfig(
      serviceClient,
      payload.projectId
    )

    if (!config || !config.is_enabled) {
      throw new AbortTaskRunError("Prompt run config is missing or disabled.")
    }

    const trackingProject = await loadTrackingProject(payload.projectId)
    const brands = await loadBrands(payload.projectId)
    const trackedPrompts = await loadTrackedPrompts(payload.projectId, config)
    const scheduledFor =
      payload.triggerType === "scheduled"
        ? config.next_run_at ?? startedAt
        : startedAt

    if (trackedPrompts.length === 0) {
      throw new AbortTaskRunError("No tracked prompts are configured for this run.")
    }

    if (!brands.some((brand) => brand.role === "primary")) {
      throw new AbortTaskRunError("A primary brand is required before prompt runs can execute.")
    }

    await updatePromptRunConfigRuntimeState(
      serviceClient,
      payload.projectId,
      {
        claimedAt: startedAt,
        currentRunId: ctx.run.id,
      }
    )

    await tags.add([
      `project:${payload.projectId}`,
      `trigger:${payload.triggerType}`,
      `cadence:${config.cadence_days}d`,
      `config:${config.id}`,
      "runner:prompt-runs",
    ])

    metadata.set("progress", {
      completedItems: 0,
      failedProviders: 0,
      phase: "load",
      startedAt,
      totalItems: trackedPrompts.length * config.enabled_providers.length,
    })

    logger.info("[prompt-runs] Orchestrator loaded config", {
      configId: config.id,
      projectId: payload.projectId,
      providerCount: config.enabled_providers.length,
      trackedPromptCount: trackedPrompts.length,
      triggerType: payload.triggerType,
    })

    try {
      const executionPlan = buildExecutionPlan(config, trackedPrompts)

      metadata.set("progress", {
        completedItems: 0,
        failedProviders: 0,
        phase: "execute",
        startedAt,
        totalItems: executionPlan.length,
      })

      const executionResults = await executeSingleProviderPrompt.batchTriggerAndWait(
        await Promise.all(
          executionPlan.map(async (item) => ({
            options: {
              idempotencyKey: await idempotencyKeys.create(
                `${ctx.run.id}:${item.trackedPromptId}:${item.providerId}`
              ),
              idempotencyKeyTTL: "1h",
              queue: getProviderQueueName(item.providerId),
            },
            payload: item,
          }))
        )
      )
      const providerResults = executionResults.runs.map((result, index) =>
        result.ok
          ? result.output
          : {
              citations: [],
              errorCode: "failed",
              errorMessage:
                result.error instanceof Error
                  ? result.error.message
                  : "Provider execution failed.",
              inputTokens: null,
              latencyMs: null,
              outputTokens: null,
              projectId: executionPlan[index].projectId,
              projectTopicId: executionPlan[index].projectTopicId,
              promptText: executionPlan[index].promptText,
              providerId: executionPlan[index].providerId,
              providerModel: null,
              rawResponseJson: null,
              rawResponseText: null,
              respondedAt: new Date().toISOString(),
              status: "failed" as const,
              trackedPromptId: executionPlan[index].trackedPromptId,
            }
      )

      metadata.set("progress", {
        completedItems: providerResults.filter(
          (result) => result.status === "completed"
        ).length,
        failedProviders: providerResults.filter(
          (result) => result.status !== "completed"
        ).length,
        phase: "analyze",
        startedAt,
        totalItems: providerResults.length,
      })

      const analyzedResult = await analyzeResponses.triggerAndWait({
        brands,
        cadenceDays: config.cadence_days,
        configId: config.id,
        projectId: payload.projectId,
        responses: providerResults,
        scheduledFor,
        startedAt,
        trackedPrompts,
        triggerType: payload.triggerType,
      })

      if (!analyzedResult.ok) {
        throw analyzedResult.error
      }

      metadata.set("progress", {
        completedItems: providerResults.length,
        failedProviders: providerResults.filter(
          (result) => result.status !== "completed"
        ).length,
        phase: "persist",
        startedAt,
        totalItems: providerResults.length,
      })

      const persistResult = await persistResults.triggerAndWait(analyzedResult.output)

      if (!persistResult.ok) {
        throw persistResult.error
      }

      await updatePromptRunConfigRuntimeState(serviceClient, payload.projectId, {
        claimedAt: null,
        currentRunId: null,
        lastRunAt: startedAt,
        nextRunAt: calculateNextPromptRunAt({
          cadenceDays: config.cadence_days,
          referenceDate: new Date(),
          scheduledRunLocalTime: config.scheduled_run_local_time,
          timeZone: trackingProject.reporting_timezone,
        }).toISOString(),
      })

      metadata.set("progress", {
        completedItems: providerResults.length,
        failedProviders: providerResults.filter(
          (result) => result.status !== "completed"
        ).length,
        phase: "done",
        startedAt,
        totalItems: providerResults.length,
      })

      logger.info("[prompt-runs] Orchestrator completed", {
        projectId: payload.projectId,
        responseCount: persistResult.output.responseCount,
        triggerType: payload.triggerType,
      })

      return {
        configId: config.id,
        discoveredCompetitorCount: persistResult.output.discoveredCompetitorCount,
        projectId: payload.projectId,
        responseCount: persistResult.output.responseCount,
        runId: ctx.run.id,
        triggerType: payload.triggerType,
      }
    } catch (error) {
      await updatePromptRunConfigRuntimeState(serviceClient, payload.projectId, {
        claimedAt: null,
        currentRunId: null,
      })

      logger.error("[prompt-runs] Orchestrator failed", {
        error: error instanceof Error ? error.message : error,
        projectId: payload.projectId,
        triggerType: payload.triggerType,
      })

      throw error
    }
  },
})
