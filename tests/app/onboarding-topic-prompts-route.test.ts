import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthenticateOnboardingRequest = vi.fn()
const mockCreateAuthenticatedOnboardingClient = vi.fn()
const mockGenerateTopicPromptCollection = vi.fn()
const mockListSiteCrawlPagesByRun = vi.fn()

vi.mock("@/lib/onboarding", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/onboarding")>("@/lib/onboarding")

  return {
    ...actual,
    authenticateOnboardingRequest: mockAuthenticateOnboardingRequest,
    createAuthenticatedOnboardingClient: mockCreateAuthenticatedOnboardingClient,
    generateTopicPromptCollection: mockGenerateTopicPromptCollection,
  }
})

vi.mock("@/lib/site-crawl-pages/repository", () => ({
  listSiteCrawlPagesByRun: mockListSiteCrawlPagesByRun,
}))

async function loadRoute() {
  const route = await import("@/app/api/onboarding/topic-prompts/route")

  return route.POST
}

function makeCatalogResponse() {
  return {
    catalog: {
      brand: "Acme",
      businessType: "saas",
      domain: "acme.com",
      primaryCategory: "ai search software",
      topics: [
        {
          description:
            "Commercial discovery prompts for AI search and answer-engine tooling.",
          id: "ai-search-software",
          name: "ai search software",
          prompts: [
            {
              id: "ai-search-software-1",
              intent: "recommendation" as const,
              text: "What are the best AI search visibility tools for brand teams?",
            },
          ],
        },
      ],
    },
    topics: [
      {
        clusterId: "ai-search-software",
        intentSummary: "Buyer evaluation for AI search software",
        prompts: [
          {
            addedVia: "ai_suggested" as const,
            generationMetadata: {
              businessType: "saas",
              primaryCategory: "ai search software",
              topicId: "ai-search-software",
              topicName: "ai search software",
            },
            intent: "recommendation" as const,
            promptText:
              "What are the best AI search visibility tools for brand teams?",
            scoreMetadata: {
              generation: {
                businessType: "saas",
                primaryCategory: "ai search software",
              },
            },
            scoreStatus: "unscored" as const,
            sourceAnalysisRunId: "analysis-1",
          },
        ],
        source: "ai_suggested" as const,
        sourceUrls: ["https://acme.com/platform"],
        topicDescription:
          "Commercial discovery prompts for AI search and answer-engine tooling.",
        topicName: "ai search software",
      },
    ],
    warnings: [],
  }
}

describe("POST /api/onboarding/topic-prompts", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthenticateOnboardingRequest.mockReset()
    mockCreateAuthenticatedOnboardingClient.mockReset()
    mockGenerateTopicPromptCollection.mockReset()
    mockListSiteCrawlPagesByRun.mockReset()

    mockAuthenticateOnboardingRequest.mockResolvedValue({
      id: "user-1",
    })
    mockCreateAuthenticatedOnboardingClient.mockReturnValue({
      auth: {},
      database: {},
    })
    mockListSiteCrawlPagesByRun.mockResolvedValue([
      {
        canonical_url: "https://acme.com/platform",
        competitor_candidates_json: {
          competitors: [{ name: "OpenAI", website: "https://openai.com" }],
        },
        content_snapshot:
          "AI search software for brand teams tracking citations and answer-engine visibility.",
        crawl_run_id: "analysis-1",
        created_at: "2026-01-01T00:00:00.000Z",
        entities_json: {
          entities: ["citations", "brand teams"],
          evidenceSnippets: ["Tracks citations across AI answers."],
        },
        id: "page-1",
        intents_json: {
          confidence: 0.82,
          intents: ["vendor discovery", "comparison"],
        },
        meta_description: "Track AI answer visibility",
        page_metadata_json: {
          priority: 1,
        },
        page_type: "product_hub",
        project_id: "project-1",
        selection_reason: "Core product page",
        selection_score: 95,
        title: "Acme platform",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ])
    mockGenerateTopicPromptCollection.mockResolvedValue(makeCatalogResponse())
  })

  it("returns 401 without a valid bearer token", async () => {
    mockAuthenticateOnboardingRequest.mockResolvedValue(null)

    const POST = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/onboarding/topic-prompts", {
        body: JSON.stringify({
          analysisRunId: "analysis-1",
          companyName: "Acme",
          competitors: [],
          description: "Description",
          website: "https://acme.com",
        }),
        method: "POST",
      })
    )

    expect(response.status).toBe(401)
  })

  it("loads persisted crawl pages and returns a full catalog refresh payload", async () => {
    const POST = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/onboarding/topic-prompts", {
        body: JSON.stringify({
          analysisRunId: "analysis-1",
          companyName: "Acme",
          competitors: [
            { name: "OpenAI", website: "https://openai.com" },
            { name: "Anthropic", website: "https://anthropic.com" },
          ],
          description: "Description",
          excludedPromptTexts: ["what is ai search"],
          excludedTopicNames: ["brand search"],
          topics: [{ source: "user_added", topicName: "ai search software" }],
          website: "https://acme.com",
        }),
        headers: {
          Authorization: "Bearer token-123",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    expect(mockCreateAuthenticatedOnboardingClient).toHaveBeenCalledWith(
      "Bearer token-123"
    )
    expect(mockListSiteCrawlPagesByRun).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: {},
        database: {},
      }),
      "analysis-1"
    )
    expect(mockGenerateTopicPromptCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisRunId: "analysis-1",
        excludedPromptTexts: ["what is ai search"],
        excludedTopicNames: ["brand search"],
        mode: "full_refresh",
        scrapedPages: [
          expect.objectContaining({
            contentSnapshot:
              "AI search software for brand teams tracking citations and answer-engine visibility.",
            pageType: "product_hub",
            url: "https://acme.com/platform",
          }),
        ],
      })
    )
    await expect(response.json()).resolves.toEqual(makeCatalogResponse())
  })

  it("returns 502 when full catalog refresh generation fails", async () => {
    mockGenerateTopicPromptCollection.mockRejectedValue(
      new Error("Unable to generate a valid onboarding GEO catalog after 2 attempts.")
    )

    const POST = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/onboarding/topic-prompts", {
        body: JSON.stringify({
          analysisRunId: "analysis-1",
          companyName: "Acme",
          competitors: [],
          description: "Description",
          website: "https://acme.com",
        }),
        headers: {
          Authorization: "Bearer token-123",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: {
        message:
          "Unable to generate a valid onboarding GEO catalog after 2 attempts.",
      },
    })
  })
})
