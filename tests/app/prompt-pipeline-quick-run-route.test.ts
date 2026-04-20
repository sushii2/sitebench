import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthenticatePromptPipelineRequest = vi.fn()
const mockCreateAuthenticatedPromptPipelineClient = vi.fn()
const mockStartPromptPipelineQuickRun = vi.fn()

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
    startPromptPipelineQuickRun: mockStartPromptPipelineQuickRun,
  }
})

async function loadRoute() {
  return import("@/app/api/prompt-pipeline/quick-run/route")
}

describe("POST /api/prompt-pipeline/quick-run", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthenticatePromptPipelineRequest.mockReset()
    mockCreateAuthenticatedPromptPipelineClient.mockReset()
    mockStartPromptPipelineQuickRun.mockReset()

    mockAuthenticatePromptPipelineRequest.mockResolvedValue({
      id: "user-1",
    })
    mockCreateAuthenticatedPromptPipelineClient.mockReturnValue({
      auth: {},
      database: {},
    })
    mockStartPromptPipelineQuickRun.mockResolvedValue({
      pipelineRunId: "pipeline-run-1",
      status: "queued",
      workflowRunId: "workflow-run-1",
    })
  })

  it("returns 401 without authentication", async () => {
    mockAuthenticatePromptPipelineRequest.mockResolvedValue(null)

    const { POST } = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/prompt-pipeline/quick-run", {
        method: "POST",
      })
    )

    expect(response.status).toBe(401)
  })

  it("returns 200 and the queued run identifiers", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/prompt-pipeline/quick-run", {
        headers: {
          Authorization: "Bearer token-123",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      pipelineRunId: "pipeline-run-1",
      status: "queued",
      workflowRunId: "workflow-run-1",
    })
    expect(mockStartPromptPipelineQuickRun).toHaveBeenCalledWith(
      {
        auth: {},
        database: {},
      },
      "Bearer token-123"
    )
  })

  it("returns 409 when a run is already active", async () => {
    mockStartPromptPipelineQuickRun.mockRejectedValue(
      new Error("A prompt pipeline run is already queued or running.")
    )

    const { POST } = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/prompt-pipeline/quick-run", {
        headers: {
          Authorization: "Bearer token-123",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "A prompt pipeline run is already queued or running.",
      },
    })
  })
})
