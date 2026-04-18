import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGenerateText = vi.fn()
const mockEmbedMany = vi.fn()
const mockJsonSchema = vi.fn((schema: unknown) => ({
  jsonSchema: async () => schema,
  validate: async (value: unknown) => ({ success: true, value }),
}))
const mockStepCountIs = vi.fn((count: number) => ({
  count,
  type: "stepCountIs",
}))
const mockPerplexitySearch = vi.fn((options?: Record<string, unknown>) => ({
  options,
  type: "perplexity_search",
}))
const mockGetGatewayTools = vi.fn(() => ({
  perplexitySearch: mockPerplexitySearch,
}))
const mockGetLanguageModel = vi.fn(
  (_providerId: string, options?: { capability?: string }) => ({
    capability: options?.capability ?? "default",
    provider: "gateway",
  })
)
const mockGetEmbeddingModel = vi.fn(() => ({
  modelId: "openai/text-embedding-3-small",
  provider: "gateway",
}))
const mockLoadSiteCrawlRun = vi.fn()
const mockUpdateSiteCrawlRun = vi.fn()
const mockListSiteCrawlPagesByRun = vi.fn()
const mockGenerateTopicPromptCollection = vi.fn()

vi.mock("ai", () => ({
  Output: {
    object: ({ schema }: { schema: unknown }) => ({ schema }),
  },
  cosineSimilarity: () => 0,
  embedMany: mockEmbedMany,
  generateText: mockGenerateText,
  jsonSchema: mockJsonSchema,
  stepCountIs: mockStepCountIs,
}))

vi.mock("@/lib/ai/provider-config", () => ({
  getEmbeddingModel: mockGetEmbeddingModel,
  getGatewayTools: mockGetGatewayTools,
  getLanguageModel: mockGetLanguageModel,
}))

vi.mock("@/lib/site-crawl-runs/repository", () => ({
  createSiteCrawlRun: vi.fn(),
  loadSiteCrawlRun: mockLoadSiteCrawlRun,
  updateSiteCrawlRun: mockUpdateSiteCrawlRun,
}))

vi.mock("@/lib/site-crawl-pages/repository", () => ({
  listSiteCrawlPagesByRun: mockListSiteCrawlPagesByRun,
  replaceSiteCrawlPages: vi.fn(),
}))

vi.mock("@/lib/onboarding/firecrawl", () => ({
  getOnboardingCrawlStatus: vi.fn(),
  mapWebsiteUrls: vi.fn(),
  scrapeBrandHomepage: vi.fn(),
  startOnboardingCrawl: vi.fn(),
  toFirecrawlDocuments: vi.fn(),
}))

vi.mock("@/lib/onboarding/normalize", () => ({
  buildFallbackOnboardingSuggestions: vi.fn(),
  mergeOnboardingWarnings: vi.fn(),
  normalizeBrandOnboarding: vi.fn(),
}))

vi.mock("@/lib/onboarding/topic-prompt-generator", () => ({
  generateTopicPromptCollection: mockGenerateTopicPromptCollection,
}))

vi.mock("@/lib/onboarding/analysis-logging", () => ({
  logOnboardingAnalysisError: vi.fn(),
  logOnboardingAnalysisEvent: vi.fn(),
}))

async function loadAnalysisModule() {
  return import("@/lib/onboarding/analysis")
}

describe("advanceOnboardingAnalysisRun", () => {
  beforeEach(() => {
    vi.resetModules()
    mockEmbedMany.mockReset()
    mockGenerateText.mockReset()
    mockGenerateTopicPromptCollection.mockReset()
    mockGetEmbeddingModel.mockClear()
    mockGetGatewayTools.mockClear()
    mockGetLanguageModel.mockClear()
    mockJsonSchema.mockClear()
    mockListSiteCrawlPagesByRun.mockReset()
    mockLoadSiteCrawlRun.mockReset()
    mockPerplexitySearch.mockClear()
    mockStepCountIs.mockClear()
    mockUpdateSiteCrawlRun.mockReset()

    const pageSignals = [
      {
        canonical_url: "https://acme.com/pricing",
        competitor_candidates_json: {
          competitors: [],
        },
        confidence: 0.92,
        content_snapshot: "Pricing overview for AI visibility software.",
        entities_json: {
          entities: ["Acme Pricing"],
        },
        evidenceSnippets: ["Pricing overview for AI visibility software."],
        intents: ["pricing evaluation"],
        intents_json: {
          intents: ["pricing evaluation"],
        },
        meta_description: "Pricing overview",
        pageType: "pricing",
        page_metadata_json: {},
        selection_reason: "Pricing page",
        selection_score: 95,
        summary: "Pricing overview for AI visibility software.",
        title: "Pricing",
        url: "https://acme.com/pricing",
      },
    ]

    mockLoadSiteCrawlRun
      .mockResolvedValueOnce({
        firecrawl_job_ids: [],
        id: "analysis-1",
        project_id: "project-1",
        result_json: {
          companyName: "Acme",
          pageSignals,
          website: "https://acme.com",
        },
        status: "extracting",
        warnings: [],
      })
      .mockResolvedValueOnce({
        firecrawl_job_ids: [],
        id: "analysis-1",
        project_id: "project-1",
        result_json: {
          companyName: "Acme",
          pageSignals,
          website: "https://acme.com",
        },
        status: "extracting",
        warnings: [],
      })

    mockListSiteCrawlPagesByRun.mockResolvedValue([])
    mockEmbedMany.mockResolvedValue({
      embeddings: [[0.1, 0.2]],
    })
    mockGenerateText
      .mockResolvedValueOnce({
        output: {
          adjacentCategories: ["brand intelligence"],
          category: "AI visibility platform",
          competitors: [
            {
              name: "Competitor 1",
              website: "https://competitor-1.com",
            },
          ],
          differentiators: ["citation tracking", "executive reporting"],
          description: "Acme helps teams measure AI visibility.",
          evidenceUrls: ["https://acme.com/pricing"],
          productCategories: ["AI visibility"],
          targetAudiences: ["marketing teams"],
          topUseCases: ["track citations in ChatGPT"],
          warnings: [],
        },
      })
      .mockResolvedValueOnce({
        output: {
          topics: [
            {
              clusterId: "cluster-1",
              intentSummary: "Buyer evaluation of AI visibility software",
              source: "ai_suggested",
              sourceUrls: ["https://acme.com/pricing"],
              topicName: "AI visibility software",
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        output: {
          topics: [
            {
              prompts: [
                {
                  brandRelevance: "direct",
                  commercialValue: "high",
                  intentType: "comparison",
                  likelyCompetitors: ["Competitor 1"],
                  persona: "Marketing lead",
                  promptText:
                    "How does Acme compare with Competitor 1 on pricing?",
                  purchaseStage: "decision",
                  rationale: "Matches the pricing intent and product category.",
                  segment: "marketing teams",
                  templateText:
                    "{company} vs {competitor_list} for {job_to_be_done}",
                  variantType: "comparison",
                },
              ],
              topicName: "AI visibility software",
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        sources: [
          {
            sourceType: "url",
            title: "Acme Pricing",
            url: "https://acme.com/pricing",
          },
        ],
        text: [
          "Prompt evaluation notes:",
          "- Prompt: How does Acme compare with Competitor 1 on pricing?",
          "  Keep: yes",
          "  Reason: Matches the pricing intent and aligns with the source material.",
          "  Evidence URL: https://acme.com/pricing",
        ].join("\n"),
      })
      .mockResolvedValueOnce({
        output: {
          scoredPrompts: [
            {
              breakdown: {
                brandCompetitorRelevance: 10,
                buyerValue: 15,
                evidenceGrounding: 10,
                naturalUserPhrasing: 20,
                specificity: 15,
                topicFit: 30,
              },
              evidenceUrls: ["https://acme.com/pricing"],
              keep: true,
              pqsScore: 93,
              reason: "Matches the pricing intent.",
              renderedPromptText:
                "How does Acme compare with Competitor 1 on pricing?",
              replacementPromptText: null,
              variantType: "comparison",
            },
          ],
        },
      })
    mockGenerateTopicPromptCollection.mockResolvedValue({
      topics: [
        {
          prompts: [
            {
              addedVia: "ai_suggested",
              promptText:
                "How does Acme compare with Competitor 1 on pricing?",
              scoreMetadata: {
                brandRelevance: "direct",
                commercialValue: "high",
                intentType: "comparison",
              },
              scoreStatus: "unscored",
              templateText:
                "{company} vs {competitor_list} for {job_to_be_done}",
              variantType: "comparison",
            },
          ],
          source: "ai_suggested",
          topicName: "AI visibility software",
        },
      ],
      warnings: [],
    })
    mockUpdateSiteCrawlRun.mockImplementation(async (_client, id, patch) => ({
      id,
      status: patch.status ?? "extracting",
      warnings: patch.warnings ?? [],
    }))
  })

  it("builds a brand profile, clustered topics, structured prompt candidates, and then scores them", async () => {
    const { advanceOnboardingAnalysisRun } = await loadAnalysisModule()
    const client = {
      auth: {} as never,
      database: {} as never,
    }

    await advanceOnboardingAnalysisRun(client, "analysis-1")

    expect(mockGenerateText).toHaveBeenCalledTimes(4)
    const brandProfileCall = mockGenerateText.mock.calls[0]?.[0]
    const topicCall = mockGenerateText.mock.calls[1]?.[0]
    const searchCall = mockGenerateText.mock.calls[2]?.[0]
    const scoringCall = mockGenerateText.mock.calls[3]?.[0]

    expect(brandProfileCall.system).toContain(
      "Return a structured brand profile grounded in the supplied crawl evidence."
    )
    expect(topicCall.system).toContain(
      "Use the brand profile plus the crawl evidence to generate buyer-facing topic clusters."
    )
    expect(mockGenerateTopicPromptCollection).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisRunId: "analysis-1",
        brandProfile: expect.objectContaining({
          category: "AI visibility platform",
          topUseCases: ["track citations in ChatGPT"],
        }),
      })
    )
    expect(mockStepCountIs).toHaveBeenCalledWith(3)
    expect(searchCall.stopWhen).toEqual({
      count: 3,
      type: "stepCountIs",
    })
    expect(searchCall.tools).toEqual({
      perplexity_search: {
        options: {
          country: "US",
          maxResults: 5,
          searchLanguageFilter: ["en"],
        },
        type: "perplexity_search",
      },
    })
    expect(searchCall.output).toBeUndefined()
    expect(scoringCall.tools).toBeUndefined()
    expect(scoringCall.output).toBeDefined()
    expect(scoringCall.prompt).toContain("Web research notes:")
    expect(scoringCall.prompt).toContain("Grounding URLs:")
  })
})
