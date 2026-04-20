import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthenticatePromptPipelineRequest = vi.fn()
const mockCreateAuthenticatedPromptPipelineClient = vi.fn()
const mockTerminatePromptPipelineRun = vi.fn()

vi.mock("@/lib/prompt-pipeline", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/prompt-pipeline")>(
      "@/lib/prompt-pipeline"
    )

  return {
    ...actual,
    authenticatePromptPipelineRequest: mockAuthenticatePromptPipelineRequest,
    createAuthenticatedPromptPipelineClient:
      mockCreateAuthenticatedPromptPipelineClient,
    terminatePromptPipelineRun: mockTerminatePromptPipelineRun,
  }
})

async function loadRoute() {
  return import("@/app/api/prompt-pipeline/runs/[pipelineRunId]/route")
}

describe("DELETE /api/prompt-pipeline/runs/[pipelineRunId]", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthenticatePromptPipelineRequest.mockReset()
    mockCreateAuthenticatedPromptPipelineClient.mockReset()
    mockTerminatePromptPipelineRun.mockReset()

    mockAuthenticatePromptPipelineRequest.mockResolvedValue({
      id: "user-1",
    })
    mockCreateAuthenticatedPromptPipelineClient.mockReturnValue({
      auth: {},
      database: {},
    })
    mockTerminatePromptPipelineRun.mockResolvedValue({
      activePrompts: [],
      activeTopics: [],
      config: null,
      hasActiveRun: false,
      latestRun: null,
      reportingTimezone: "UTC",
    })
  })

  it("returns 401 without authentication", async () => {
    mockAuthenticatePromptPipelineRequest.mockResolvedValue(null)

    const { DELETE } = await loadRoute()
    const response = await DELETE(
      new Request("http://localhost/api/prompt-pipeline/runs/pipeline-run-1", {
        method: "DELETE",
      }),
      {
        params: Promise.resolve({
          pipelineRunId: "pipeline-run-1",
        }),
      }
    )

    expect(response.status).toBe(401)
  })

  it("terminates the active run and returns refreshed screen data", async () => {
    const { DELETE } = await loadRoute()
    const response = await DELETE(
      new Request("http://localhost/api/prompt-pipeline/runs/pipeline-run-1", {
        headers: {
          Authorization: "Bearer token-123",
        },
        method: "DELETE",
      }),
      {
        params: Promise.resolve({
          pipelineRunId: "pipeline-run-1",
        }),
      }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      activePrompts: [],
      activeTopics: [],
      config: null,
      hasActiveRun: false,
      latestRun: null,
      reportingTimezone: "UTC",
    })
    expect(mockTerminatePromptPipelineRun).toHaveBeenCalledWith(
      {
        auth: {},
        database: {},
      },
      "pipeline-run-1",
      "Bearer token-123"
    )
  })
})
