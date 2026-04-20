import { FatalError, RetryableError } from "workflow"

import { runPromptOnPlatform } from "@/lib/prompt-pipeline/ai"
import type {
  PromptPipelinePlatformExecutionState,
  PromptPipelinePlatformResult,
} from "@/workflows/prompt-pipeline/types"
import {
  recordPromptPipelineTraceEvent,
  toPromptPipelineErrorMessage,
} from "@/workflows/prompt-pipeline/steps/shared"

function toPromptPipelineErrorDetails(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return {
      error,
    }
  }

  const record = error as Record<string, unknown>

  return {
    causeMessage:
      record.cause instanceof Error ? record.cause.message : record.cause ?? null,
    errorName: typeof record.name === "string" ? record.name : null,
    errorType: typeof record.type === "string" ? record.type : null,
    response:
      typeof record.response === "object" && record.response !== null
        ? record.response
        : null,
    statusCode:
      typeof record.statusCode === "number" ? record.statusCode : null,
  }
}

function classifyPromptPipelineError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error"

  if (
    /429|5\d\d|network|socket|timeout|timed out|temporar|fetch failed|gateway request failed|invalid response from gateway|invalid error response format|response_error|timeout_error/i.test(
      message
    )
  ) {
    return new RetryableError(message)
  }

  if (
    /auth|api key|invalid|unsupported|schema|tool|model|permission/i.test(
      message
    )
  ) {
    return new FatalError(message)
  }

  return new FatalError(message)
}

export async function runPromptOnPlatformStep(
  input: PromptPipelinePlatformExecutionState
): Promise<Omit<PromptPipelinePlatformResult, "parsedBrands" | "parsedCitations" | "parserWarnings">> {
  "use step"

  await recordPromptPipelineTraceEvent({
    detailJson: {
      platformCode: input.platformCode,
      promptRunId: input.prompt.prompt_run_id,
      trackedPromptId: input.prompt.tracked_prompt_id,
    },
    message: `Running prompt on ${input.platformCode}.`,
    pipelineRunId: input.pipelineRunId,
    status: "running",
    stepKey: "run_prompt_on_platform",
  })

  try {
    const result = await runPromptOnPlatform(
      input.platformCode,
      input.prompt.prompt_text
    )

    await recordPromptPipelineTraceEvent({
      detailJson: {
        latencyMs: result.latencyMs,
        modelId: result.modelId,
        platformCode: input.platformCode,
        promptRunId: input.prompt.prompt_run_id,
      },
      message: `Completed ${input.platformCode} execution.`,
      pipelineRunId: input.pipelineRunId,
      status: "completed",
      stepKey: "run_prompt_on_platform",
    })

    return {
      ...input,
      inputTokens: result.inputTokens,
      latencyMs: result.latencyMs,
      modelId: result.modelId,
      outputTokens: result.outputTokens,
      rawResponseJson: result.rawResponseJson,
      rawResponseText: result.rawResponseText,
    }
  } catch (error) {
    await recordPromptPipelineTraceEvent({
      detailJson: {
        platformCode: input.platformCode,
        promptRunId: input.prompt.prompt_run_id,
      },
      message: `Failed ${input.platformCode} execution: ${toPromptPipelineErrorMessage(error)}`,
      pipelineRunId: input.pipelineRunId,
      status: "failed",
      stepKey: "run_prompt_on_platform",
    })

    console.error("[prompt-pipeline] Platform execution failed", {
      ...toPromptPipelineErrorDetails(error),
      platformCode: input.platformCode,
      promptRunId: input.prompt.prompt_run_id,
    })

    throw classifyPromptPipelineError(error)
  }
}

runPromptOnPlatformStep.maxRetries = 1
