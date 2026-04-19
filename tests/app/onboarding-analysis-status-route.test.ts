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
          comparisonSets: ["Acme vs Hoka"],
          conversionMoments: ["buy trail shoes before race day"],
          detailedDescription:
            "Acme sells performance footwear and apparel for runners.",
          differentiators: ["wide-fit trail assortment"],
          evidenceUrls: ["https://acme.com/collections/trail-running"],
          geography: "United States",
          jobsToBeDone: ["find durable running shoes", "shop by fit"],
          keywords: ["running shoes", "trail shoes"],
          pricing: "mid-market retail pricing",
          primaryCategory: "running shoes",
          primarySubcategory: "trail running shoes",
          products: ["trail shoes", "road shoes", "running apparel"],
          reputationalQuestions: ["Is Acme worth the price?"],
          researchJourneys: ["compare trail shoes by terrain and fit"],
          secondaryCategories: ["athletic apparel"],
          siteArchetype: "ecommerce",
          targetAudiences: ["gift buyers"],
          targetCustomers: ["runners", "active shoppers"],
          warnings: [],
        },
        catalog: {
          brand: "Acme",
          businessType: "ecommerce",
          domain: "acme.com",
          primaryCategory: "running shoes",
          topics: [
            {
              description: "Buyer discovery for trail running shoes.",
              id: "trail-running-shoes",
              name: "trail running shoes",
              prompts: [
                {
                  id: "trail-running-shoes-1",
                  intent: "recommendation",
                  text: "What trail running shoes are best for rocky terrain and wide feet?",
                },
              ],
            },
          ],
        },
        competitors: [
          { name: "Competitor 1", website: "https://competitor-1.com" },
        ],
        description: "Suggested description",
        topics: [
          {
            clusterId: "cluster-1",
            intentSummary: "Buyer discovery for trail running shoes",
            prompts: [
              {
                addedVia: "ai_suggested",
                generationMetadata: {
                  brand: "Acme",
                  businessType: "ecommerce",
                  domain: "acme.com",
                  evidenceUrls: [],
                  primaryCategory: "running shoes",
                  sourceUrls: ["https://acme.com/collections/trail-running"],
                  topicDescription: "Buyer discovery for trail running shoes.",
                  topicId: "trail-running-shoes",
                  topicName: "trail running shoes",
                },
                intent: "recommendation",
                promptText:
                  "What trail running shoes are best for rocky terrain and wide feet?",
                scoreMetadata: {
                  generation: {
                    primaryCategory: "running shoes",
                  },
                },
                scoreStatus: "unscored",
                sourceAnalysisRunId: "analysis-1",
              },
            ],
            source: "ai_suggested",
            sourceUrls: ["https://acme.com/collections/trail-running"],
            topicDescription: "Buyer discovery for trail running shoes.",
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
