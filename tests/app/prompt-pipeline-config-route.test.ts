import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthenticatePromptPipelineRequest = vi.fn()
const mockCreateAuthenticatedPromptPipelineClient = vi.fn()
const mockLoadPromptPipelineConfigScreen = vi.fn()
const mockSavePromptPipelineConfigForProject = vi.fn()

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
    loadPromptPipelineConfigScreen: mockLoadPromptPipelineConfigScreen,
    savePromptPipelineConfigForProject:
      mockSavePromptPipelineConfigForProject,
  }
})

async function loadRoute() {
  return import("@/app/api/prompt-pipeline/config/route")
}

describe("/api/prompt-pipeline/config", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthenticatePromptPipelineRequest.mockReset()
    mockCreateAuthenticatedPromptPipelineClient.mockReset()
    mockLoadPromptPipelineConfigScreen.mockReset()
    mockSavePromptPipelineConfigForProject.mockReset()

    mockAuthenticatePromptPipelineRequest.mockResolvedValue({
      id: "user-1",
    })
    mockCreateAuthenticatedPromptPipelineClient.mockReturnValue({
      auth: {},
      database: {},
    })
    mockLoadPromptPipelineConfigScreen.mockResolvedValue({
      activePrompts: [],
      activeTopics: [],
      config: null,
      hasActiveRun: false,
    })
    mockSavePromptPipelineConfigForProject.mockResolvedValue({
      activePrompts: [],
      activeTopics: [],
      config: {
        frequency: "weekly",
        selected_prompt_ids: ["prompt-1"],
      },
      hasActiveRun: false,
    })
  })

  it("returns 401 for unauthenticated reads", async () => {
    mockAuthenticatePromptPipelineRequest.mockResolvedValue(null)

    const { GET } = await loadRoute()
    const response = await GET(
      new Request("http://localhost/api/prompt-pipeline/config")
    )

    expect(response.status).toBe(401)
  })

  it("returns the prompt pipeline config screen data", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      new Request("http://localhost/api/prompt-pipeline/config", {
        headers: {
          Authorization: "Bearer token-123",
        },
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      activePrompts: [],
      activeTopics: [],
      config: null,
      hasActiveRun: false,
    })
    expect(mockCreateAuthenticatedPromptPipelineClient).toHaveBeenCalledWith(
      "Bearer token-123"
    )
  })

  it("rejects invalid config payloads", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/prompt-pipeline/config", {
        body: JSON.stringify({
          frequency: "weekly",
          selectedPromptIds: [],
        }),
        headers: {
          Authorization: "Bearer token-123",
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "At least one prompt must be selected.",
      },
    })
  })

  it("saves config updates for authenticated users", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/prompt-pipeline/config", {
        body: JSON.stringify({
          frequency: "weekly",
          selectedPromptIds: ["prompt-1"],
        }),
        headers: {
          Authorization: "Bearer token-123",
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      activePrompts: [],
      activeTopics: [],
      config: {
        frequency: "weekly",
        selected_prompt_ids: ["prompt-1"],
      },
      hasActiveRun: false,
    })
    expect(mockSavePromptPipelineConfigForProject).toHaveBeenCalledWith(
      {
        auth: {},
        database: {},
      },
      {
        frequency: "weekly",
        selectedPromptIds: ["prompt-1"],
      },
      "Bearer token-123"
    )
  })
})
