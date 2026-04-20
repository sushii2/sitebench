import { recordPromptPipelineRunTrace } from "@/lib/prompt-pipeline/repository"
import { createPromptPipelineWorkflowRpcClient } from "@/lib/prompt-pipeline/workflow-rpc-client"
import type { PromptPipelineRunTrace } from "@/lib/prompt-pipeline/types"

export function createPromptPipelineWorkflowClient() {
  return createPromptPipelineWorkflowRpcClient()
}

export function toPromptPipelineErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown prompt pipeline error."
}

export async function recordPromptPipelineTraceEvent(input: {
  detailJson?: Record<string, unknown> | null
  message: string
  pipelineRunId: string
  status: PromptPipelineRunTrace["status"]
  stepKey: string
}) {
  console.log("[prompt-pipeline][trace]", input)

  try {
    const client = createPromptPipelineWorkflowClient()

    await recordPromptPipelineRunTrace(client, input)
  } catch (error) {
    console.error("[prompt-pipeline][trace] Unable to persist trace", {
      message: toPromptPipelineErrorMessage(error),
      pipelineRunId: input.pipelineRunId,
      stepKey: input.stepKey,
    })
  }
}
