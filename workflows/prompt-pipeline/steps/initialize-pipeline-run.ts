import { FatalError } from "workflow"

import { beginPromptPipelineRun } from "@/lib/prompt-pipeline/repository"
import {
  createPromptPipelineWorkflowClient,
  recordPromptPipelineTraceEvent,
  toPromptPipelineErrorMessage,
} from "@/workflows/prompt-pipeline/steps/shared"
import type {
  PromptPipelineWorkflowInput,
  PromptPipelineWorkflowState,
} from "@/workflows/prompt-pipeline/types"

export async function initializePipelineRunStep(
  input: PromptPipelineWorkflowInput
): Promise<PromptPipelineWorkflowState> {
  "use step"

  await recordPromptPipelineTraceEvent({
    detailJson: {
      configId: input.configId,
      triggerType: input.triggerType,
    },
    message: "Initializing pipeline run.",
    pipelineRunId: input.pipelineRunId,
    status: "running",
    stepKey: "initialize_pipeline_run",
  })

  try {
    const client = createPromptPipelineWorkflowClient()
    const payload = await beginPromptPipelineRun(client, input)

    if (payload.selected_prompts.length === 0) {
      throw new FatalError("The saved prompt pipeline config has no selected prompts.")
    }

    await recordPromptPipelineTraceEvent({
      detailJson: {
        promptCount: payload.selected_prompts.length,
      },
      message: `Initialized pipeline run with ${payload.selected_prompts.length} prompt${payload.selected_prompts.length === 1 ? "" : "s"}.`,
      pipelineRunId: input.pipelineRunId,
      status: "completed",
      stepKey: "initialize_pipeline_run",
    })

    return {
      ...input,
      pipelineRun: payload.pipeline_run,
      selectedPrompts: payload.selected_prompts,
    }
  } catch (error) {
    await recordPromptPipelineTraceEvent({
      message: toPromptPipelineErrorMessage(error),
      pipelineRunId: input.pipelineRunId,
      status: "failed",
      stepKey: "initialize_pipeline_run",
    })

    throw error
  }
}
