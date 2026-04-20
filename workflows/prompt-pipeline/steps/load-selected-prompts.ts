import { FatalError } from "workflow"

import type { PromptPipelineWorkflowState } from "@/workflows/prompt-pipeline/types"
import {
  recordPromptPipelineTraceEvent,
  toPromptPipelineErrorMessage,
} from "@/workflows/prompt-pipeline/steps/shared"

export async function loadSelectedPromptsStep(
  input: PromptPipelineWorkflowState
): Promise<PromptPipelineWorkflowState> {
  "use step"

  await recordPromptPipelineTraceEvent({
    detailJson: {
      promptCount: input.selectedPrompts.length,
    },
    message: "Loading selected prompts.",
    pipelineRunId: input.pipelineRunId,
    status: "running",
    stepKey: "load_selected_prompts",
  })

  try {
    if (input.selectedPrompts.length === 0) {
      throw new FatalError("The prompt pipeline run has no queued prompts.")
    }

    await recordPromptPipelineTraceEvent({
      detailJson: {
        promptCount: input.selectedPrompts.length,
      },
      message: `Loaded ${input.selectedPrompts.length} queued prompt${input.selectedPrompts.length === 1 ? "" : "s"}.`,
      pipelineRunId: input.pipelineRunId,
      status: "completed",
      stepKey: "load_selected_prompts",
    })

    return input
  } catch (error) {
    await recordPromptPipelineTraceEvent({
      message: toPromptPipelineErrorMessage(error),
      pipelineRunId: input.pipelineRunId,
      status: "failed",
      stepKey: "load_selected_prompts",
    })

    throw error
  }
}
