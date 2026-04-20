import { finalizePromptPipelineRunRecord } from "@/lib/prompt-pipeline/repository"
import {
  createPromptPipelineWorkflowClient,
  recordPromptPipelineTraceEvent,
  toPromptPipelineErrorMessage,
} from "@/workflows/prompt-pipeline/steps/shared"

export async function finalizePromptPipelineRunStep(input: {
  failureReason?: string | null
  pipelineRunId: string
  status: "completed" | "failed" | "cancelled"
}) {
  "use step"

  await recordPromptPipelineTraceEvent({
    detailJson: {
      requestedStatus: input.status,
    },
    message: `Finalizing pipeline run as ${input.status}.`,
    pipelineRunId: input.pipelineRunId,
    status: input.status === "failed" ? "failed" : input.status,
    stepKey: "finalize_pipeline_run",
  })

  try {
    const client = createPromptPipelineWorkflowClient()

    if (input.status === "cancelled") {
      throw new Error("Cancelled pipeline runs must be reconciled before finalization.")
    }

    await finalizePromptPipelineRunRecord(client, {
      failureReason: input.failureReason,
      pipelineRunId: input.pipelineRunId,
      status: input.status,
    })

    await recordPromptPipelineTraceEvent({
      detailJson: {
        requestedStatus: input.status,
      },
      message: `Pipeline run finalized as ${input.status}.`,
      pipelineRunId: input.pipelineRunId,
      status: input.status,
      stepKey: "finalize_pipeline_run",
    })
  } catch (error) {
    await recordPromptPipelineTraceEvent({
      message: toPromptPipelineErrorMessage(error),
      pipelineRunId: input.pipelineRunId,
      status: "failed",
      stepKey: "finalize_pipeline_run",
    })

    throw error
  }
}
