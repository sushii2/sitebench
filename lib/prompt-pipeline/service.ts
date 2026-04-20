import { getRun, start } from "workflow/api"

import { loadCurrentUserBrand } from "@/lib/brands"
import { createPromptPipelineServerClient } from "@/lib/prompt-pipeline/auth"
import {
  beginPromptPipelineRun,
  claimDuePromptPipelineConfigs,
  loadPromptPipelineConfigByProject,
  loadPromptPipelineConfigScreen,
  resolveBlockingPromptPipelineRun,
  terminatePromptPipelineRunRecord,
} from "@/lib/prompt-pipeline/repository"
import { promptPipelineWorkflow } from "@/workflows/prompt-pipeline"
import type { PromptPipelineClient } from "@/lib/prompt-pipeline/service.types"

async function resolveCurrentProjectId(client: PromptPipelineClient) {
  const brand = await loadCurrentUserBrand(client)

  if (!brand?.id) {
    throw new Error("You must complete onboarding before using the prompt pipeline.")
  }

  return brand.id
}

function buildWorkflowInput(input: {
  configId: string
  pipelineRunId: string
  projectId: string
  requestId: string
  scheduledFor: string
  triggerType: "manual" | "scheduled"
}) {
  return {
    configId: input.configId,
    pipelineRunId: input.pipelineRunId,
    projectId: input.projectId,
    requestId: input.requestId,
    scheduledFor: input.scheduledFor,
    triggerType: input.triggerType,
  }
}

export async function startPromptPipelineQuickRun(
  client: PromptPipelineClient,
  authorization?: string | null
) {
  void authorization

  const projectId = await resolveCurrentProjectId(client)
  const config = await loadPromptPipelineConfigByProject(client, projectId)

  if (!config) {
    throw new Error("Save a prompt pipeline config before running a batch.")
  }

  const activeRun = await resolveBlockingPromptPipelineRun(client, config.id)

  if (activeRun && (activeRun.status === "queued" || activeRun.status === "running")) {
    throw new Error("A prompt pipeline run is already queued or running.")
  }

  const pipelineRunId = crypto.randomUUID()
  const requestId = crypto.randomUUID()
  const scheduledFor = new Date().toISOString()
  const workflowRun = await start(promptPipelineWorkflow, [
    buildWorkflowInput({
      configId: config.id,
      pipelineRunId,
      projectId,
      requestId,
      scheduledFor,
      triggerType: "manual",
    }),
  ])

  await beginPromptPipelineRun(client, {
    configId: config.id,
    pipelineRunId,
    projectId,
    requestId,
    scheduledFor,
    triggerType: "manual",
    workflowRunId: workflowRun.runId,
  })

  return {
    pipelineRunId,
    status: "queued" as const,
    workflowRunId: workflowRun.runId,
  }
}

export async function terminatePromptPipelineRun(
  client: PromptPipelineClient,
  pipelineRunId: string,
  authorization?: string | null
) {
  void authorization

  if (!pipelineRunId.trim()) {
    throw new Error("Pipeline run ID is required.")
  }

  const projectId = await resolveCurrentProjectId(client)
  const config = await loadPromptPipelineConfigByProject(client, projectId)

  if (!config) {
    throw new Error("Save a prompt pipeline config before managing a batch.")
  }

  const activeRun = await resolveBlockingPromptPipelineRun(client, config.id)

  if (
    !activeRun ||
    (activeRun.status !== "queued" && activeRun.status !== "running") ||
    activeRun.id !== pipelineRunId
  ) {
    throw new Error("No queued or running prompt pipeline run matches the requested run.")
  }

  console.info("[prompt-pipeline] Terminating active pipeline run", {
    pipelineRunId,
    projectId,
    workflowRunId: activeRun.workflow_run_id,
  })

  if (activeRun.workflow_run_id) {
    try {
      const workflowRun = getRun(activeRun.workflow_run_id)
      const workflowExists = await workflowRun.exists

      if (workflowExists) {
        await workflowRun.cancel()
      }
    } catch (error) {
      console.error("[prompt-pipeline] Unable to cancel workflow run before cleanup", {
        message: error instanceof Error ? error.message : "Unknown error",
        pipelineRunId,
        workflowRunId: activeRun.workflow_run_id,
      })
    }
  }

  await terminatePromptPipelineRunRecord(client, pipelineRunId)

  console.info("[prompt-pipeline] Terminated active pipeline run", {
    pipelineRunId,
    projectId,
  })

  return loadPromptPipelineConfigScreen(client)
}

export async function startDuePromptPipelineRuns() {
  const client = createPromptPipelineServerClient()
  const claimedConfigs = await claimDuePromptPipelineConfigs(client, 10)
  const workflowRunIds: string[] = []

  for (const claimedConfig of claimedConfigs) {
    const pipelineRunId = crypto.randomUUID()
    const requestId = crypto.randomUUID()
    const workflowRun = await start(promptPipelineWorkflow, [
      buildWorkflowInput({
        configId: claimedConfig.config_id,
        pipelineRunId,
        projectId: claimedConfig.project_id,
        requestId,
        scheduledFor: claimedConfig.scheduled_for,
        triggerType: "scheduled",
      }),
    ])

    await beginPromptPipelineRun(client, {
      configId: claimedConfig.config_id,
      pipelineRunId,
      projectId: claimedConfig.project_id,
      requestId,
      scheduledFor: claimedConfig.scheduled_for,
      triggerType: "scheduled",
      workflowRunId: workflowRun.runId,
    })

    workflowRunIds.push(workflowRun.runId)
  }

  return {
    enqueuedCount: workflowRunIds.length,
    workflowRunIds,
  }
}
