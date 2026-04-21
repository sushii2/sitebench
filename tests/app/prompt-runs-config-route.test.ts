import { beforeEach, describe, expect, it, vi } from "vitest"

const PROJECT_ID = "123e4567-e89b-12d3-a456-426614174000"
const TOPIC_ID = "123e4567-e89b-12d3-a456-426614174001"
const PROMPT_ID = "123e4567-e89b-12d3-a456-426614174002"

const mockAuthenticateOnboardingRequest = vi.fn()
const mockCreateAuthenticatedOnboardingClient = vi.fn()
const mockLoadPromptRunConfig = vi.fn()
const mockUpsertPromptRunConfig = vi.fn()
const mockDisablePromptRunConfig = vi.fn()
const mockLoadProjectTopics = vi.fn()
const mockLoadTrackedPromptsByProject = vi.fn()

vi.mock("@/lib/onboarding", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/onboarding")>("@/lib/onboarding")

  return {
    ...actual,
    authenticateOnboardingRequest: mockAuthenticateOnboardingRequest,
    createAuthenticatedOnboardingClient: mockCreateAuthenticatedOnboardingClient,
  }
})

vi.mock("@/lib/prompt-run-configs/repository", () => ({
  disablePromptRunConfig: mockDisablePromptRunConfig,
  loadPromptRunConfig: mockLoadPromptRunConfig,
  upsertPromptRunConfig: mockUpsertPromptRunConfig,
}))

vi.mock("@/lib/project-topics/repository", () => ({
  loadProjectTopics: mockLoadProjectTopics,
}))

vi.mock("@/lib/tracked-prompts/repository", () => ({
  loadTrackedPromptsByProject: mockLoadTrackedPromptsByProject,
}))

async function loadRoute() {
  return import("@/app/api/prompt-runs/config/route")
}

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    cadence_days: 7,
    claimed_at: null,
    created_at: "2026-04-21T00:00:00.000Z",
    current_run_id: null,
    enabled_providers: ["chatgpt", "claude"],
    id: "config-1",
    is_enabled: true,
    last_run_at: null,
    next_run_at: null,
    project_id: PROJECT_ID,
    scheduled_run_local_time: "09:00",
    selected_project_topic_ids: [TOPIC_ID],
    selected_tracked_prompt_ids: [PROMPT_ID],
    updated_at: "2026-04-21T00:00:00.000Z",
    ...overrides,
  }
}

describe("/api/prompt-runs/config", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthenticateOnboardingRequest.mockReset()
    mockCreateAuthenticatedOnboardingClient.mockReset()
    mockLoadPromptRunConfig.mockReset()
    mockUpsertPromptRunConfig.mockReset()
    mockDisablePromptRunConfig.mockReset()
    mockLoadProjectTopics.mockReset()
    mockLoadTrackedPromptsByProject.mockReset()

    mockAuthenticateOnboardingRequest.mockResolvedValue({
      id: "user-1",
    })
    mockCreateAuthenticatedOnboardingClient.mockReturnValue({
      auth: {},
      database: {},
    })
    mockLoadProjectTopics.mockResolvedValue([
      {
        id: TOPIC_ID,
        is_active: true,
        project_id: PROJECT_ID,
      },
    ])
    mockLoadTrackedPromptsByProject.mockResolvedValue([
      {
        id: PROMPT_ID,
        is_active: true,
        project_id: PROJECT_ID,
        project_topic_id: TOPIC_ID,
      },
    ])
  })

  it("returns 401 when the user is not authenticated", async () => {
    mockAuthenticateOnboardingRequest.mockResolvedValue(null)
    const { GET } = await loadRoute()
    const response = await GET(
      new Request(
        `http://localhost/api/prompt-runs/config?projectId=${PROJECT_ID}`
      )
    )

    expect(response.status).toBe(401)
  })

  it("returns 404 when the config is missing", async () => {
    mockLoadPromptRunConfig.mockResolvedValue(null)
    const { GET } = await loadRoute()
    const response = await GET(
      new Request(
        `http://localhost/api/prompt-runs/config?projectId=${PROJECT_ID}`,
        {
          headers: {
            Authorization: "Bearer token-123",
          },
        }
      )
    )

    expect(response.status).toBe(404)
  })

  it("saves a validated prompt run config", async () => {
    mockUpsertPromptRunConfig.mockResolvedValue(makeConfig())
    const { POST } = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/prompt-runs/config", {
        body: JSON.stringify({
          cadenceDays: 7,
          enabledProviders: ["chatgpt", "claude"],
          projectId: PROJECT_ID,
          scheduledRunLocalTime: "09:00",
          selectedProjectTopicIds: [TOPIC_ID],
          selectedTrackedPromptIds: [PROMPT_ID],
        }),
        headers: {
          Authorization: "Bearer token-123",
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    expect(mockUpsertPromptRunConfig).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        enabledProviders: ["chatgpt", "claude"],
      })
    )
    await expect(response.json()).resolves.toEqual({
      config: makeConfig(),
    })
  })

  it("rejects prompts outside the current project", async () => {
    mockLoadTrackedPromptsByProject.mockResolvedValue([])
    const { POST } = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/prompt-runs/config", {
        body: JSON.stringify({
          cadenceDays: 7,
          enabledProviders: ["chatgpt"],
          projectId: PROJECT_ID,
          scheduledRunLocalTime: "09:00",
          selectedProjectTopicIds: [TOPIC_ID],
          selectedTrackedPromptIds: [PROMPT_ID],
        }),
        headers: {
          Authorization: "Bearer token-123",
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(400)
  })

  it("disables a saved prompt run config", async () => {
    mockDisablePromptRunConfig.mockResolvedValue(
      makeConfig({
        is_enabled: false,
      })
    )
    const { DELETE } = await loadRoute()
    const response = await DELETE(
      new Request(
        `http://localhost/api/prompt-runs/config?projectId=${PROJECT_ID}`,
        {
          headers: {
            Authorization: "Bearer token-123",
          },
          method: "DELETE",
        }
      )
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      config: makeConfig({
        is_enabled: false,
      }),
    })
  })
})
