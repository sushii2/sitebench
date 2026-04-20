import { finalizePromptRunRecord } from "@/lib/prompt-pipeline/repository"
import {
  createPromptPipelineWorkflowClient,
  recordPromptPipelineTraceEvent,
  toPromptPipelineErrorMessage,
} from "@/workflows/prompt-pipeline/steps/shared"

export async function finalizePromptRunStep(input: {
  pipelineRunId: string
  promptRunId: string
}) {
  "use step"

  await recordPromptPipelineTraceEvent({
    detailJson: {
      promptRunId: input.promptRunId,
    },
    message: "Finalizing prompt run.",
    pipelineRunId: input.pipelineRunId,
    status: "running",
    stepKey: "finalize_prompt_run",
  })

  try {
    const client = createPromptPipelineWorkflowClient()

    await finalizePromptRunRecord(client, input.promptRunId)

    await recordPromptPipelineTraceEvent({
      detailJson: {
        promptRunId: input.promptRunId,
      },
      message: "Finalized prompt run.",
      pipelineRunId: input.pipelineRunId,
      status: "completed",
      stepKey: "finalize_prompt_run",
    })
  } catch (error) {
    await recordPromptPipelineTraceEvent({
      detailJson: {
        promptRunId: input.promptRunId,
      },
      message: toPromptPipelineErrorMessage(error),
      pipelineRunId: input.pipelineRunId,
      status: "failed",
      stepKey: "finalize_prompt_run",
    })

    throw error
  }
}
