import { parsePromptPlatformResult } from "@/lib/prompt-pipeline/ai"
import { recordPromptPlatformResult } from "@/lib/prompt-pipeline/repository"
import { createPromptPipelineWorkflowClient } from "@/workflows/prompt-pipeline/steps/shared"
import type { PromptPipelinePlatformResult } from "@/workflows/prompt-pipeline/types"
import {
  recordPromptPipelineTraceEvent,
  toPromptPipelineErrorMessage,
} from "@/workflows/prompt-pipeline/steps/shared"

export async function parsePlatformResponseStep(
  input: Omit<PromptPipelinePlatformResult, "parsedBrands" | "parsedCitations" | "parserWarnings">
): Promise<PromptPipelinePlatformResult> {
  "use step"

  await recordPromptPipelineTraceEvent({
    detailJson: {
      platformCode: input.platformCode,
      promptRunId: input.prompt.prompt_run_id,
    },
    message: `Parsing ${input.platformCode} response.`,
    pipelineRunId: input.pipelineRunId,
    status: "running",
    stepKey: "parse_platform_response",
  })

  try {
    const parsed = await parsePromptPlatformResult({
      promptText: input.prompt.prompt_text,
      rawResponseJson: input.rawResponseJson,
      rawResponseText: input.rawResponseText,
    })
    const client = createPromptPipelineWorkflowClient()

    await recordPromptPlatformResult(client, {
      inputTokens: input.inputTokens,
      latencyMs: input.latencyMs,
      outputTokens: input.outputTokens,
      parsedBrands: parsed.brands,
      parsedCitations: parsed.citations,
      parserWarnings: parsed.warnings,
      platformCode: input.platformCode,
      promptRunId: input.prompt.prompt_run_id,
      providerModel: input.modelId,
      rawResponseJson: input.rawResponseJson,
      rawResponseText: input.rawResponseText,
      status: "completed",
    })

    await recordPromptPipelineTraceEvent({
      detailJson: {
        brandCount: parsed.brands.length,
        citationCount: parsed.citations.length,
        platformCode: input.platformCode,
        promptRunId: input.prompt.prompt_run_id,
        warningCount: parsed.warnings.length,
      },
      message: `Persisted parsed ${input.platformCode} response.`,
      pipelineRunId: input.pipelineRunId,
      status: "completed",
      stepKey: "parse_platform_response",
    })

    return {
      ...input,
      parsedBrands: parsed.brands,
      parsedCitations: parsed.citations,
      parserWarnings: parsed.warnings,
    }
  } catch (error) {
    await recordPromptPipelineTraceEvent({
      detailJson: {
        platformCode: input.platformCode,
        promptRunId: input.prompt.prompt_run_id,
      },
      message: `Failed to parse ${input.platformCode} response: ${toPromptPipelineErrorMessage(error)}`,
      pipelineRunId: input.pipelineRunId,
      status: "failed",
      stepKey: "parse_platform_response",
    })

    throw error
  }
}

export async function persistFailedPlatformResponseStep(input: {
  errorCode: string | null
  errorMessage: string
  platformCode: "chatgpt" | "claude" | "perplexity"
  pipelineRunId: string
  promptRunId: string
}) {
  "use step"

  const client = createPromptPipelineWorkflowClient()

  await recordPromptPlatformResult(client, {
    errorCode: input.errorCode,
    errorMessage: input.errorMessage,
    inputTokens: null,
    latencyMs: null,
    outputTokens: null,
    parsedBrands: [],
    parsedCitations: [],
    parserWarnings: [],
    platformCode: input.platformCode,
    promptRunId: input.promptRunId,
    providerModel: null,
    rawResponseJson: null,
    rawResponseText: null,
    status: "failed",
  })

  await recordPromptPipelineTraceEvent({
    detailJson: {
      errorCode: input.errorCode,
      platformCode: input.platformCode,
      promptRunId: input.promptRunId,
    },
    message: `Persisted failed ${input.platformCode} response: ${input.errorMessage}`,
    pipelineRunId: input.pipelineRunId,
    status: "failed",
    stepKey: "persist_failed_platform_response",
  })
}
