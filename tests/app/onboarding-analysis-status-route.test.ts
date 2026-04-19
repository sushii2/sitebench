import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthenticateOnboardingRequest = vi.fn()
const mockCreateAuthenticatedOnboardingClient = vi.fn()
const mockLoadOnboardingAnalysisRunStatus = vi.fn()

vi.mock("@/lib/onboarding", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/onboarding")>("@/lib/onboarding")

  return {
    ...actual,
    authenticateOnboardingRequest: mockAuthenticateOnboardingRequest,
    createAuthenticatedOnboardingClient: mockCreateAuthenticatedOnboardingClient,
    loadOnboardingAnalysisRunStatus: mockLoadOnboardingAnalysisRunStatus,
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
    mockLoadOnboardingAnalysisRunStatus.mockReset()

    mockAuthenticateOnboardingRequest.mockResolvedValue({
      id: "user-1",
    })
    mockCreateAuthenticatedOnboardingClient.mockReturnValue({
      auth: {},
      database: {},
    })
    mockLoadOnboardingAnalysisRunStatus.mockResolvedValue({
      analysisId: "analysis-1",
      result: {
        brandProfile: {
          careers: null,
          categories: ["running shoes", "athletic apparel"],
          detailedDescription:
            "Acme sells performance footwear and apparel for runners.",
          geography: "United States",
          jobsToBeDone: ["find durable running shoes", "shop by fit"],
          keywords: ["running shoes", "trail shoes"],
          pricing: "mid-market retail pricing",
          primaryCategory: "running shoes",
          primarySubcategory: "trail running shoes",
          products: ["trail shoes", "road shoes", "running apparel"],
          siteArchetype: "ecommerce",
          targetCustomers: ["runners", "active shoppers"],
          warnings: [],
        },
        competitors: [
          { name: "Competitor 1", website: "https://competitor-1.com" },
        ],
        description: "Suggested description",
        topics: [
          {
            clusterId: "cluster-1",
            intentSummary: "Buyer discovery for trail running shoes",
            prompts: [],
            source: "ai_suggested",
            sourceUrls: ["https://acme.com/collections/trail-running"],
            topicName: "trail running shoes",
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

  it("loads persisted analysis status without advancing the workflow", async () => {
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
    await expect(response.json()).resolves.toMatchObject({
      analysisId: "analysis-1",
      status: "completed",
    })
    expect(mockCreateAuthenticatedOnboardingClient).toHaveBeenCalledWith(
      "Bearer token-123"
    )
    expect(mockLoadOnboardingAnalysisRunStatus).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: {},
        database: {},
      }),
      "analysis-1"
    )
  })
})
