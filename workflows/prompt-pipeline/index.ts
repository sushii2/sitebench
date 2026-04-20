import { finalizePromptPipelineRunStep } from "@/workflows/prompt-pipeline/steps/finalize-pipeline-run"
import { finalizePromptRunStep } from "@/workflows/prompt-pipeline/steps/finalize-prompt-run"
import { initializePipelineRunStep } from "@/workflows/prompt-pipeline/steps/initialize-pipeline-run"
import { loadSelectedPromptsStep } from "@/workflows/prompt-pipeline/steps/load-selected-prompts"
import {
  parsePlatformResponseStep,
  persistFailedPlatformResponseStep,
} from "@/workflows/prompt-pipeline/steps/parse-platform-response"
import { runPromptOnPlatformStep } from "@/workflows/prompt-pipeline/steps/run-prompt-on-platform"
import { toPromptPipelineErrorMessage } from "@/workflows/prompt-pipeline/steps/shared"
import type { PromptPipelineWorkflowInput } from "@/workflows/prompt-pipeline/types"

export type { PromptPipelineWorkflowInput } from "@/workflows/prompt-pipeline/types"

const PLATFORM_CODES = ["chatgpt", "claude", "perplexity"] as const

function chunk<T>(items: T[], size: number) {
  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }

  return chunks
}

function toPlatformErrorCode(error: unknown) {
  const message = toPromptPipelineErrorMessage(error)

  if (/429|rate/i.test(message)) {
    return "rate_limited"
  }

  if (/timeout|timed out/i.test(message)) {
    return "timeout"
  }

  return "failed"
}

async function executePromptAcrossPlatforms(
  input: Awaited<ReturnType<typeof loadSelectedPromptsStep>>["selectedPrompts"][number],
  workflowState: Awaited<ReturnType<typeof loadSelectedPromptsStep>>
) {
  await Promise.all(
    PLATFORM_CODES.map(async (platformCode) => {
      try {
        const executed = await runPromptOnPlatformStep({
          ...workflowState,
          platformCode,
          prompt: input,
        })

        await parsePlatformResponseStep(executed)
      } catch (error) {
        await persistFailedPlatformResponseStep({
          errorCode: toPlatformErrorCode(error),
          errorMessage: toPromptPipelineErrorMessage(error),
          platformCode,
          pipelineRunId: workflowState.pipelineRunId,
          promptRunId: input.prompt_run_id,
        })
      }
    })
  )

  await finalizePromptRunStep({
    pipelineRunId: workflowState.pipelineRunId,
    promptRunId: input.prompt_run_id,
  })
}

export async function promptPipelineWorkflow(input: PromptPipelineWorkflowInput) {
  "use workflow"

  try {
    const initialized = await initializePipelineRunStep(input)
    const loaded = await loadSelectedPromptsStep(initialized)

    for (const batch of chunk(loaded.selectedPrompts, 5)) {
      await Promise.all(
        batch.map((prompt) => executePromptAcrossPlatforms(prompt, loaded))
      )
    }

    await finalizePromptPipelineRunStep({
      pipelineRunId: input.pipelineRunId,
      status: "completed",
    })
  } catch (error) {
    await finalizePromptPipelineRunStep({
      failureReason: toPromptPipelineErrorMessage(error),
      pipelineRunId: input.pipelineRunId,
      status: "failed",
    })

    throw error
  }
}
