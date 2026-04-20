import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGenerateText = vi.fn()
const mockGetLanguageModel = vi.fn(
  (_providerId: string, options?: { capability?: string; modelId?: string }) => ({
    capability: options?.capability ?? "default",
    modelId: options?.modelId ?? "default-model",
    provider: "gateway",
  })
)
const mockPersistRunPhase = vi.fn()
const mockReplaceSiteCrawlPages = vi.fn()

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>()

  return {
    ...actual,
    Output: {
      ...actual.Output,
      object: (config: Record<string, unknown>) => config,
    },
    generateText: mockGenerateText,
  }
})

vi.mock("@/lib/ai/provider-config", () => ({
  getLanguageModel: mockGetLanguageModel,
}))

vi.mock("@/lib/site-crawl-pages/repository", () => ({
  replaceSiteCrawlPages: mockReplaceSiteCrawlPages,
}))

vi.mock("@/workflows/onboarding-analysis/steps/shared", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/workflows/onboarding-analysis/steps/shared")
    >()

  return {
    ...actual,
    createWorkflowOnboardingClient: () => ({
      auth: {},
      database: {},
    }),
    persistRunPhase: mockPersistRunPhase,
  }
})

async function loadStepModule() {
  return import("@/workflows/onboarding-analysis/steps/extract-page-signals")
}

describe("extractPageSignalsStep", () => {
  beforeEach(() => {
    vi.resetModules()
    mockGenerateText.mockReset()
    mockGetLanguageModel.mockClear()
    mockPersistRunPhase.mockReset()
    mockReplaceSiteCrawlPages.mockReset()
  })

  it("extracts page-level entities, intents, and competitors then persists them", async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        pages: [
          {
            competitorCandidates: [
              { name: "Tines", website: "https://tines.com" },
            ],
            confidence: 0.84,
            entities: ["audit evidence", "Okta", "Snowflake"],
            evidenceSnippets: [
              "Automate audit evidence collection.",
              "Integrates with Okta and Snowflake.",
            ],
            intents: ["vendor comparison", "implementation planning"],
            pageType: "product_hub",
            url: "https://acme.com/platform",
          },
        ],
      },
    })

    const { extractPageSignalsStep } = await loadStepModule()

    const result = await extractPageSignalsStep({
      analysisId: "analysis-1",
      analysisVersion: 2,
      authToken: "user-token",
      classifiedPages: [],
      companyName: "Acme",
      homepage: null,
      homepageClassification: {
        buyerLanguage: ["automate investigations"],
        categories: ["security automation"],
        pageEquivalentPatterns: [],
        personas: ["security teams"],
        pricingModel: "enterprise SaaS pricing",
        primaryCategory: "security automation",
        primarySubcategory: "security automation platform",
        secondaryCategories: [],
        siteArchetype: "saas",
      },
      mappedPages: [],
      prefilteredPages: [],
      projectId: "project-1",
      scrapedPages: [
        {
          expectedSignals: ["audit evidence", "integrations"],
          html: "<html></html>",
          markdown:
            "Automate audit evidence collection with Okta and Snowflake integrations.",
          pageRole: "product_hub",
          priority: 1,
          title: "Security automation platform",
          url: "https://acme.com/platform",
          whySelected: "Core product page",
        },
      ],
      selectedPages: [
        {
          candidateScore: 0.95,
          expectedSignals: ["audit evidence", "integrations"],
          pageRole: "product_hub",
          priority: 1,
          url: "https://acme.com/platform",
          whySelected: "Core product page",
        },
      ],
      timings: {},
      warnings: [],
      website: "https://acme.com",
    })

    expect(mockGetLanguageModel).toHaveBeenCalledWith("openai", {
      capability: "structuredOutput",
      modelId: "openai/gpt-5.4",
    })
    expect(mockReplaceSiteCrawlPages).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: {},
        database: {},
      }),
      "analysis-1",
      "project-1",
      [
        expect.objectContaining({
          canonical_url: "https://acme.com/platform",
          competitor_candidates_json: {
            competitors: [{ name: "Tines", website: "https://tines.com" }],
          },
          entities_json: {
            confidence: 0.84,
            entities: ["audit evidence", "Okta", "Snowflake"],
            evidenceSnippets: [
              "Automate audit evidence collection.",
              "Integrates with Okta and Snowflake.",
            ],
          },
          intents_json: {
            confidence: 0.84,
            intents: ["vendor comparison", "implementation planning"],
          },
        }),
      ]
    )
    expect(result.pageSignals).toEqual([
      {
        competitorCandidates: [{ name: "Tines", website: "https://tines.com" }],
        confidence: 0.84,
        entities: ["audit evidence", "Okta", "Snowflake"],
        evidenceSnippets: [
          "Automate audit evidence collection.",
          "Integrates with Okta and Snowflake.",
        ],
        intents: ["vendor comparison", "implementation planning"],
        pageType: "product_hub",
        url: "https://acme.com/platform",
      },
    ])
  })
})
