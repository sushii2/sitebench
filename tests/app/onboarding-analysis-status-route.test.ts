import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthenticateOnboardingRequest = vi.fn()
const mockCreateAuthenticatedOnboardingClient = vi.fn()
const mockAdvanceOnboardingAnalysisRun = vi.fn()

vi.mock("@/lib/onboarding", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/onboarding")>("@/lib/onboarding")

  return {
    ...actual,
    advanceOnboardingAnalysisRun: mockAdvanceOnboardingAnalysisRun,
    authenticateOnboardingRequest: mockAuthenticateOnboardingRequest,
    createAuthenticatedOnboardingClient: mockCreateAuthenticatedOnboardingClient,
  }
})

async function loadRoute() {
  const route = await import("@/app/api/onboarding/analysis/[analysisId]/route")

  return route.GET
}

describe("GET /api/onboarding/analysis/[analysisId]", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthenticateOnboardingRequest.mockReset()
    mockCreateAuthenticatedOnboardingClient.mockReset()
    mockAdvanceOnboardingAnalysisRun.mockReset()

    mockAuthenticateOnboardingRequest.mockResolvedValue({
      id: "user-1",
    })
    mockCreateAuthenticatedOnboardingClient.mockReturnValue({
      auth: {},
      database: {},
    })
    mockAdvanceOnboardingAnalysisRun.mockResolvedValue({
      analysisId: "analysis-1",
      result: {
        competitors: [
          { name: "Competitor 1", website: "https://competitor-1.com" },
        ],
        description: "Suggested description",
        topics: [
          {
            clusterId: "cluster-1",
            intentSummary: "Buyer discovery for AI visibility software",
            prompts: [],
            source: "ai_suggested",
            sourceUrls: ["https://acme.com/pricing"],
            topicName: "ai visibility",
          },
        ],
        warnings: [],
      },
      status: "completed",
      warnings: [],
    })
  })

  it("returns 401 without auth", async () => {
    mockAuthenticateOnboardingRequest.mockResolvedValue(null)

    const GET = await loadRoute()
    const response = await GET(
      new Request("http://localhost/api/onboarding/analysis/analysis-1"),
      {
        params: Promise.resolve({
          analysisId: "analysis-1",
        }),
      }
    )

    expect(response.status).toBe(401)
  })

  it("returns the advanced analysis status", async () => {
    const GET = await loadRoute()
    const response = await GET(
      new Request("http://localhost/api/onboarding/analysis/analysis-1", {
        headers: {
          Authorization: "Bearer token-123",
        },
      }),
      {
        params: Promise.resolve({
          analysisId: "analysis-1",
        }),
      }
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      analysisId: "analysis-1",
      result: {
        competitors: [
          { name: "Competitor 1", website: "https://competitor-1.com" },
        ],
        description: "Suggested description",
        topics: [
          {
            clusterId: "cluster-1",
            intentSummary: "Buyer discovery for AI visibility software",
            prompts: [],
            source: "ai_suggested",
            sourceUrls: ["https://acme.com/pricing"],
            topicName: "ai visibility",
          },
        ],
        warnings: [],
      },
      status: "completed",
      warnings: [],
    })
    expect(mockAdvanceOnboardingAnalysisRun).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: {},
        database: {},
      }),
      "analysis-1"
    )
  })
})
