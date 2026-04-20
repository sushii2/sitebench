import { FatalError, RetryableError } from "workflow"
import { beforeEach, describe, expect, it, vi } from "vitest"

const runPromptOnPlatformMock = vi.fn()

vi.mock("@/lib/prompt-pipeline/ai", () => ({
  runPromptOnPlatform: runPromptOnPlatformMock,
}))

describe("runPromptOnPlatformStep", () => {
  beforeEach(() => {
    runPromptOnPlatformMock.mockReset()
  })

  it("retries gateway response-format failures", async () => {
    runPromptOnPlatformMock.mockRejectedValue(
      new Error("Invalid error response format: Gateway request failed")
    )

    const { runPromptOnPlatformStep } = await import(
      "@/workflows/prompt-pipeline/steps/run-prompt-on-platform"
    )

    await expect(
      runPromptOnPlatformStep({
        pipelineRun: {} as never,
        pipelineRunId: "pipeline-run-1",
        platformCode: "chatgpt",
        projectId: "project-1",
        prompt: {
          prompt_run_id: "prompt-run-1",
          prompt_text: "What can I buy from Lenskart online?",
        } as never,
        requestId: "request-1",
        scheduledFor: "2026-04-20T21:18:23.544Z",
        selectedPrompts: [],
        triggerType: "manual",
        configId: "config-1",
      })
    ).rejects.toBeInstanceOf(RetryableError)
  })

  it("keeps authentication failures fatal", async () => {
    runPromptOnPlatformMock.mockRejectedValue(new Error("API key is invalid"))

    const { runPromptOnPlatformStep } = await import(
      "@/workflows/prompt-pipeline/steps/run-prompt-on-platform"
    )

    await expect(
      runPromptOnPlatformStep({
        pipelineRun: {} as never,
        pipelineRunId: "pipeline-run-1",
        platformCode: "chatgpt",
        projectId: "project-1",
        prompt: {
          prompt_run_id: "prompt-run-1",
          prompt_text: "What can I buy from Lenskart online?",
        } as never,
        requestId: "request-1",
        scheduledFor: "2026-04-20T21:18:23.544Z",
        selectedPrompts: [],
        triggerType: "manual",
        configId: "config-1",
      })
    ).rejects.toBeInstanceOf(FatalError)
  })
})
