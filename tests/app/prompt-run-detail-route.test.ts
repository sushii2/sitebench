import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthenticatePromptPipelineRequest = vi.fn()
const mockCreateAuthenticatedPromptPipelineClient = vi.fn()
const mockLoadPromptRunChatPayload = vi.fn()

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
    loadPromptRunChatPayload: mockLoadPromptRunChatPayload,
  }
})

async function loadRoute() {
  return import("@/app/api/prompt-runs/[promptRunId]/route")
}

describe("GET /api/prompt-runs/[promptRunId]", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthenticatePromptPipelineRequest.mockReset()
    mockCreateAuthenticatedPromptPipelineClient.mockReset()
    mockLoadPromptRunChatPayload.mockReset()

    mockAuthenticatePromptPipelineRequest.mockResolvedValue({
      id: "user-1",
    })
    mockCreateAuthenticatedPromptPipelineClient.mockReturnValue({
      auth: {},
      database: {},
    })
    mockLoadPromptRunChatPayload.mockResolvedValue({
      promptRun: {
        id: "prompt-run-1",
      },
      providerResponses: [],
      recentPromptRuns: [],
      topicName: "AI visibility",
      trackedPromptText: "Best AI monitoring platforms",
    })
  })

  it("returns 401 without auth", async () => {
    mockAuthenticatePromptPipelineRequest.mockResolvedValue(null)

    const { GET } = await loadRoute()
    const response = await GET(
      new Request("http://localhost/api/prompt-runs/prompt-run-1"),
      {
        params: Promise.resolve({
          promptRunId: "prompt-run-1",
        }),
      }
    )

    expect(response.status).toBe(401)
  })

  it("returns 404 when the prompt run cannot be loaded", async () => {
    mockLoadPromptRunChatPayload.mockResolvedValue(null)

    const { GET } = await loadRoute()
    const response = await GET(
      new Request("http://localhost/api/prompt-runs/prompt-run-1", {
        headers: {
          Authorization: "Bearer token-123",
        },
      }),
      {
        params: Promise.resolve({
          promptRunId: "prompt-run-1",
        }),
      }
    )

    expect(response.status).toBe(404)
  })

  it("returns the authenticated replay payload", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      new Request("http://localhost/api/prompt-runs/prompt-run-1", {
        headers: {
          Authorization: "Bearer token-123",
        },
      }),
      {
        params: Promise.resolve({
          promptRunId: "prompt-run-1",
        }),
      }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      promptRun: {
        id: "prompt-run-1",
      },
      providerResponses: [],
      recentPromptRuns: [],
      topicName: "AI visibility",
      trackedPromptText: "Best AI monitoring platforms",
    })
  })
})
