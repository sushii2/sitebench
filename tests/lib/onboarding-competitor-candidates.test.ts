import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGenerateText = vi.fn()
const mockStepCountIs = vi.fn((count: number) => ({
  count,
  type: "stepCountIs",
}))
const mockOpenAiWebSearchTool = vi.fn(() => ({
  type: "web_search",
}))
const mockGetLanguageModel = vi.fn(
  (_providerId: string, options?: { capability?: string; modelId?: string }) => ({
    capability: options?.capability ?? "default",
    modelId: options?.modelId ?? "default-model",
    provider: "gateway",
  })
)

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("ai")>()

  return {
    ...actual,
    Output: {
      ...actual.Output,
      object: (config: Record<string, unknown>) => config,
    },
    generateText: mockGenerateText,
    stepCountIs: mockStepCountIs,
  }
})

vi.mock("@/lib/ai/provider-config", () => ({
  getLanguageModel: mockGetLanguageModel,
  getOpenAiWebSearchTool: mockOpenAiWebSearchTool,
}))

async function loadCompetitorCandidatesModule() {
  return import("@/lib/onboarding/competitor-candidates")
}

describe("generateCompetitorCandidates", () => {
  beforeEach(() => {
    vi.resetModules()
    mockGenerateText.mockReset()
    mockGetLanguageModel.mockClear()
    mockOpenAiWebSearchTool.mockClear()
    mockStepCountIs.mockClear()
  })

  it("uses GPT-5.4 Mini with OpenAI web search", async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        competitors: [
          {
            name: "Scrunch AI",
            website: "https://scrunchai.com",
          },
        ],
      },
    })

    const { generateCompetitorCandidates } =
      await loadCompetitorCandidatesModule()

    const result = await generateCompetitorCandidates({
      brandProfile: {
        careers: null,
        categories: ["AI answer engine optimization platform", "brand intelligence"],
        comparisonSets: ["Profound alternatives"],
        conversionMoments: [],
        detailedDescription:
          "Profound helps brands understand and improve visibility in AI answer engines.",
        differentiators: ["Enterprise reporting"],
        evidenceUrls: [],
        geography: null,
        jobsToBeDone: ["Improve brand visibility in AI answers"],
        keywords: ["AI visibility"],
        pricing: "Contact sales",
        primaryCategory: "AI answer engine optimization platform",
        primarySubcategory: "",
        products: ["AI visibility platform"],
        reputationalQuestions: [],
        researchJourneys: ["Best AI visibility tools"],
        secondaryCategories: ["brand intelligence"],
        siteArchetype: "saas",
        targetAudiences: ["Enterprise marketing teams"],
        targetCustomers: ["Enterprise marketing teams"],
        warnings: [],
      },
      companyName: "Profound",
      website: "https://tryprofound.com",
    })

    expect(result).toEqual([
      {
        name: "Scrunch AI",
        website: "https://scrunchai.com",
      },
    ])
    expect(mockGetLanguageModel).toHaveBeenCalledWith("openai", {
      capability: "webSearch",
      modelId: "openai/gpt-5.4-mini",
    })
    expect(mockOpenAiWebSearchTool).toHaveBeenCalledTimes(1)
    expect(mockStepCountIs).toHaveBeenCalledWith(8)

    const generationCall = mockGenerateText.mock.calls[0]?.[0]
    expect(generationCall.output).toMatchObject({
      name: "onboarding_competitor_candidates",
    })
    expect(generationCall.tools).toEqual({
      web_search: {
        type: "web_search",
      },
    })
    expect(generationCall.stopWhen).toEqual({
      count: 8,
      type: "stepCountIs",
    })

    const prompt = generationCall.prompt as string
    expect(prompt).toContain("Company: Profound")
    expect(prompt).toContain("Website: https://tryprofound.com")
    expect(prompt).toContain(
      "Primary category: AI answer engine optimization platform"
    )
    expect(prompt).toContain("Target customers: Enterprise marketing teams")
    expect(generationCall.system).toContain("Search for the brand name and domain first")
    expect(generationCall.system).toContain("Return an empty competitor list rather than weak guesses")
  })
})
