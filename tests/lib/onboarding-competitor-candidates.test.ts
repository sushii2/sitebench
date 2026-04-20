import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGenerateText = vi.fn()
const mockStepCountIs = vi.fn((count: number) => ({
  count,
  type: "stepCountIs",
}))
const mockParallelWebSearchTool = vi.fn(() => ({
  type: "parallel_search",
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
  getParallelWebSearchTool: mockParallelWebSearchTool,
}))

async function loadCompetitorCandidatesModule() {
  return import("@/lib/onboarding/competitor-candidates")
}

describe("generateCompetitorCandidates", () => {
  beforeEach(() => {
    vi.resetModules()
    mockGenerateText.mockReset()
    mockGetLanguageModel.mockClear()
    mockParallelWebSearchTool.mockClear()
    mockStepCountIs.mockClear()
  })

  it("uses GPT-5.4 with Parallel search", async () => {
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
      capability: "structuredOutput",
      modelId: "openai/gpt-5.4",
    })
    expect(mockParallelWebSearchTool).toHaveBeenCalledTimes(1)
    expect(mockStepCountIs).toHaveBeenCalledWith(3)

    const generationCall = mockGenerateText.mock.calls[0]?.[0]
    expect(generationCall.output).toMatchObject({
      name: "onboarding_competitor_candidates",
    })
    expect(generationCall.tools).toEqual({
      parallel_search: {
        type: "parallel_search",
      },
    })
    expect(generationCall.stopWhen).toEqual({
      count: 3,
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
    expect(generationCall.system).toContain("Call parallel_search at most once")
    expect(generationCall.system).toContain("Return an empty competitor list rather than weak guesses")
  })

  it("disables search tools after the first parallel search step", async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        competitors: [],
      },
    })

    const { generateCompetitorCandidates } =
      await loadCompetitorCandidatesModule()

    await generateCompetitorCandidates({
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

    const generationCall = mockGenerateText.mock.calls[0]?.[0]

    expect(generationCall.prepareStep).toBeTypeOf("function")

    expect(
      generationCall.prepareStep({
        stepNumber: 1,
        steps: [
          {
            toolCalls: [{ toolName: "parallel_search" }],
            toolResults: [{ toolName: "parallel_search" }],
          },
        ],
      })
    ).toEqual({
      activeTools: [],
    })
  })

  it("falls back to a no-tools structured pass when search produces no output", async () => {
    const { NoOutputGeneratedError } = await import("ai")

    mockGenerateText
      .mockRejectedValueOnce(new NoOutputGeneratedError())
      .mockResolvedValueOnce({
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
    expect(mockGenerateText).toHaveBeenCalledTimes(2)

    const fallbackCall = mockGenerateText.mock.calls[1]?.[0]
    expect(fallbackCall.tools).toBeUndefined()
    expect(fallbackCall.system).toContain("Fallback mode: do not call tools.")
    expect(fallbackCall.system).toContain(
      "If the profile does not support direct competitors confidently, return an empty competitor list."
    )
  })
})
