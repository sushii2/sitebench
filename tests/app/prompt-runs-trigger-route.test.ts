import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthenticateOnboardingRequest = vi.fn()
const mockCreateAuthenticatedOnboardingClient = vi.fn()
const mockLoadPromptRunConfig = vi.fn()
const mockUpdatePromptRunConfigRuntimeState = vi.fn()
const mockCreatePublicToken = vi.fn()
const mockTrigger = vi.fn()
const mockIsPromptRunClaimStale = vi.fn()
const mockRunsRetrieve = vi.fn()

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
  loadPromptRunConfig: mockLoadPromptRunConfig,
  updatePromptRunConfigRuntimeState: mockUpdatePromptRunConfigRuntimeState,
}))

vi.mock("@/src/trigger/prompt-runs/shared", async () => {
  const actual =
    await vi.importActual<typeof import("@/src/trigger/prompt-runs/shared")>(
      "@/src/trigger/prompt-runs/shared"
    )

  return {
    ...actual,
    isPromptRunClaimStale: mockIsPromptRunClaimStale,
  }
})

vi.mock("@/src/trigger/prompt-runs/run-configured-prompts", () => ({
  runConfiguredPrompts: {
    trigger: mockTrigger,
  },
}))

vi.mock("@trigger.dev/sdk", async () => {
  const actual = await vi.importActual<typeof import("@trigger.dev/sdk")>(
    "@trigger.dev/sdk"
  )

  return {
    ...actual,
    auth: {
      createPublicToken: mockCreatePublicToken,
    },
    runs: {
      retrieve: mockRunsRetrieve,
    },
  }
})

async function loadRoute() {
  return import("@/app/api/prompt-runs/trigger/route")
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
    project_id: "123e4567-e89b-12d3-a456-426614174000",
    scheduled_run_local_time: "09:00",
    selected_project_topic_ids: ["123e4567-e89b-12d3-a456-426614174001"],
    selected_tracked_prompt_ids: ["123e4567-e89b-12d3-a456-426614174002"],
    updated_at: "2026-04-21T00:00:00.000Z",
    ...overrides,
  }
}

describe("/api/prompt-runs/trigger", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthenticateOnboardingRequest.mockReset()
    mockCreateAuthenticatedOnboardingClient.mockReset()
    mockLoadPromptRunConfig.mockReset()
    mockUpdatePromptRunConfigRuntimeState.mockReset()
    mockCreatePublicToken.mockReset()
    mockTrigger.mockReset()
    mockIsPromptRunClaimStale.mockReset()
    mockRunsRetrieve.mockReset()

    mockAuthenticateOnboardingRequest.mockResolvedValue({
      id: "user-1",
    })
    mockCreateAuthenticatedOnboardingClient.mockReturnValue({
      auth: {},
      database: {},
    })
    mockCreatePublicToken.mockResolvedValue("public-token")
    mockIsPromptRunClaimStale.mockReturnValue(true)
    mockLoadPromptRunConfig.mockResolvedValue(makeConfig())
    mockTrigger.mockResolvedValue({
      id: "run_123",
    })
    mockRunsRetrieve.mockResolvedValue({
      id: "run_existing",
      status: "EXECUTING",
    })
  })

  it("returns 401 when the user is not authenticated", async () => {
    mockAuthenticateOnboardingRequest.mockResolvedValue(null)
    const { POST } = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/prompt-runs/trigger", {
        body: JSON.stringify({
          projectId: "123e4567-e89b-12d3-a456-426614174000",
        }),
        method: "POST",
      })
    )

    expect(response.status).toBe(401)
  })

  it("returns an existing run when one is already active", async () => {
    mockLoadPromptRunConfig.mockResolvedValue(
      makeConfig({
        claimed_at: "2026-04-21T00:00:00.000Z",
        current_run_id: "run_existing",
      })
    )
    mockIsPromptRunClaimStale.mockReturnValue(false)
    const { POST } = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/prompt-runs/trigger", {
        body: JSON.stringify({
          projectId: "123e4567-e89b-12d3-a456-426614174000",
        }),
        headers: {
          Authorization: "Bearer token-123",
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    expect(mockTrigger).not.toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      publicAccessToken: "public-token",
      runId: "run_existing",
    })
  })

  it("returns 409 when a run claim exists before the run id is recorded", async () => {
    mockLoadPromptRunConfig.mockResolvedValue(
      makeConfig({
        claimed_at: "2026-04-21T00:00:00.000Z",
        current_run_id: null,
      })
    )
    mockIsPromptRunClaimStale.mockReturnValue(false)
    const { POST } = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/prompt-runs/trigger", {
        body: JSON.stringify({
          projectId: "123e4567-e89b-12d3-a456-426614174000",
        }),
        headers: {
          Authorization: "Bearer token-123",
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(409)
    expect(mockTrigger).not.toHaveBeenCalled()
  })

  it("clears the claim and triggers a new run when the referenced run has terminally failed", async () => {
    mockLoadPromptRunConfig.mockResolvedValue(
      makeConfig({
        claimed_at: "2026-04-21T00:00:00.000Z",
        current_run_id: "run_dead",
      })
    )
    mockIsPromptRunClaimStale.mockReturnValue(false)
    mockRunsRetrieve.mockResolvedValue({
      id: "run_dead",
      status: "FAILED",
    })
    const { POST } = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/prompt-runs/trigger", {
        body: JSON.stringify({
          projectId: "123e4567-e89b-12d3-a456-426614174000",
        }),
        headers: {
          Authorization: "Bearer token-123",
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    expect(mockRunsRetrieve).toHaveBeenCalledWith("run_dead")
    expect(mockUpdatePromptRunConfigRuntimeState).toHaveBeenCalledWith(
      expect.anything(),
      expect.any(String),
      expect.objectContaining({
        claimedAt: null,
        currentRunId: null,
      })
    )
    expect(mockTrigger).toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      publicAccessToken: "public-token",
      runId: "run_123",
    })
  })

  it("clears the claim and triggers a new run when the referenced run cannot be retrieved", async () => {
    mockLoadPromptRunConfig.mockResolvedValue(
      makeConfig({
        claimed_at: "2026-04-21T00:00:00.000Z",
        current_run_id: "run_missing",
      })
    )
    mockIsPromptRunClaimStale.mockReturnValue(false)
    mockRunsRetrieve.mockRejectedValue(new Error("not found"))
    const { POST } = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/prompt-runs/trigger", {
        body: JSON.stringify({
          projectId: "123e4567-e89b-12d3-a456-426614174000",
        }),
        headers: {
          Authorization: "Bearer token-123",
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    expect(mockTrigger).toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      publicAccessToken: "public-token",
      runId: "run_123",
    })
  })

  it("triggers a new manual run and returns a public token", async () => {
    const { POST } = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/prompt-runs/trigger", {
        body: JSON.stringify({
          projectId: "123e4567-e89b-12d3-a456-426614174000",
        }),
        headers: {
          Authorization: "Bearer token-123",
          "Content-Type": "application/json",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    expect(mockTrigger).toHaveBeenCalledWith(
      {
        projectId: "123e4567-e89b-12d3-a456-426614174000",
        triggerType: "manual",
      },
      expect.objectContaining({
        tags: expect.arrayContaining(["trigger:manual"]),
      })
    )
    expect(mockUpdatePromptRunConfigRuntimeState).toHaveBeenCalled()
    await expect(response.json()).resolves.toEqual({
      publicAccessToken: "public-token",
      runId: "run_123",
    })
  })
})
