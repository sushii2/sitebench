import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGenerateText = vi.fn()
const mockGetLanguageModel = vi.fn(
  (_providerId: string, options?: { capability?: string }) => ({
    capability: options?.capability ?? "default",
    provider: "gateway",
  })
)
const mockJsonSchema = vi.fn((schema: unknown) => ({
  jsonSchema: async () => schema,
  validate: async (value: unknown) => ({ success: true, value }),
}))

vi.mock("ai", () => ({
  Output: {
    object: ({ schema }: { schema: unknown }) => ({ schema }),
  },
  generateText: mockGenerateText,
  jsonSchema: mockJsonSchema,
}))

vi.mock("@/lib/ai/provider-config", () => ({
  getLanguageModel: mockGetLanguageModel,
}))

async function loadGeneratorModule() {
  return import("@/lib/onboarding/topic-prompt-generator")
}

describe("generateTopicPromptCollection", () => {
  beforeEach(() => {
    vi.resetModules()
    mockGenerateText.mockReset()
    mockGetLanguageModel.mockClear()
    mockJsonSchema.mockClear()
  })

  it("generates prompts from a structured brand profile instead of deterministic templates", async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        topics: [
          {
            prompts: [
              {
                brandRelevance: "direct",
                commercialValue: "high",
                intentType: "recommendation",
                likelyCompetitors: ["Scrunch AI", "Peec AI"],
                persona: "VP of marketing",
                promptText:
                  "What are the best AI visibility platforms for enterprise marketing teams that need citation tracking and executive reporting?",
                purchaseStage: "consideration",
                rationale:
                  "High-intent vendor evaluation prompt tied to Profound's core workflow.",
                segment: "enterprise marketing",
                templateText:
                  "What are the best {solution_category} for {segment} that need {job_to_be_done}?",
                variantType: "alternatives",
              },
              {
                brandRelevance: "direct",
                commercialValue: "high",
                intentType: "comparison",
                likelyCompetitors: ["Scrunch AI"],
                persona: "Head of brand",
                promptText:
                  "Profound vs Scrunch AI for tracking brand citations in ChatGPT and Perplexity",
                purchaseStage: "decision",
                rationale:
                  "Direct competitive evaluation prompt around a core product use case.",
                segment: "enterprise brand teams",
                templateText:
                  "{company} vs {competitor_list} for {job_to_be_done}",
                variantType: "comparison",
              },
            ],
            topicName: "ai visibility platforms",
          },
        ],
      },
    })

    const { generateTopicPromptCollection } = await loadGeneratorModule()

    const result = await generateTopicPromptCollection({
      analysisRunId: "analysis-1",
      brandProfile: {
        adjacentCategories: ["brand intelligence"],
        category: "AI visibility platform",
        competitors: [
          { name: "Scrunch AI", website: "https://scrunchai.com" },
          { name: "Peec AI", website: "https://peec.ai" },
        ],
        description:
          "Profound helps enterprise marketing teams understand and improve brand performance in AI discovery experiences.",
        differentiators: [
          "citation tracking across answer engines",
          "executive reporting",
        ],
        evidenceUrls: [
          "https://tryprofound.com/features/answer-engine-insights",
        ],
        productCategories: ["AI visibility", "citation tracking"],
        targetAudiences: ["enterprise marketing teams"],
        topUseCases: [
          "track brand citations in ChatGPT",
          "benchmark AI visibility against competitors",
        ],
        warnings: [],
      },
      companyName: "Profound",
      competitors: [
        { name: "Scrunch AI", website: "https://scrunchai.com" },
        { name: "Peec AI", website: "https://peec.ai" },
      ],
      description:
        "Profound helps enterprise marketing teams understand and improve brand performance in AI discovery experiences.",
      topics: [
        {
          intentSummary:
            "Buyer evaluation of AI visibility software for enterprise marketing teams.",
          source: "ai_suggested",
          sourceUrls: [
            "https://tryprofound.com/pricing",
            "https://tryprofound.com/features/answer-engine-insights",
          ],
          topicName: "ai visibility platforms",
        },
      ],
      website: "https://tryprofound.com",
    })

    expect(mockGetLanguageModel).toHaveBeenCalledWith("openai", {
      capability: "structuredOutput",
    })
    const generationCall = mockGenerateText.mock.calls[0]?.[0]
    expect(generationCall.system).toContain(
      "Generate realistic, commercially relevant prompts"
    )
    expect(generationCall.prompt).toContain("Category: AI visibility platform")
    expect(generationCall.prompt).toContain(
      "Top use cases: track brand citations in ChatGPT"
    )
    expect(generationCall.prompt).toContain("Topic 1: ai visibility platforms")

    const prompts = result.topics[0]?.prompts ?? []
    expect(prompts).toHaveLength(2)
    expect(prompts[0]?.scoreStatus).toBe("unscored")
    expect(prompts[0]?.pqsScore).toBeUndefined()
    expect(prompts[0]?.scoreMetadata).toMatchObject({
      brandRelevance: "direct",
      commercialValue: "high",
      intentType: "recommendation",
      persona: "VP of marketing",
      purchaseStage: "consideration",
      segment: "enterprise marketing",
    })
    expect(prompts[0]?.promptText).not.toMatch(/how do teams handle/i)
    expect(prompts[0]?.promptText).toMatch(/best AI visibility platforms/i)
    expect(prompts[1]?.promptText).toMatch(/Profound vs Scrunch AI/i)
  })

  it("falls back to a lightweight brand profile when a structured one is not provided", async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        topics: [
          {
            prompts: [
              {
                brandRelevance: "direct",
                commercialValue: "medium",
                intentType: "problem_solving",
                likelyCompetitors: ["Vercel"],
                persona: "Engineering manager",
                promptText:
                  "How should engineering teams compare frontend hosting platforms for preview deployments and fast rollback?",
                purchaseStage: "consideration",
                rationale: "Matches the product's core evaluation flow.",
                segment: "software teams",
                templateText:
                  "How should {segment} compare {solution_category} for {job_to_be_done}?",
                variantType: "discovery",
              },
            ],
            topicName: "frontend hosting comparisons",
          },
        ],
      },
    })

    const { generateTopicPromptCollection } = await loadGeneratorModule()

    await expect(
      generateTopicPromptCollection({
        analysisRunId: "analysis-1",
        companyName: "Acme",
        competitors: [{ name: "Vercel", website: "https://vercel.com" }],
        description:
          "Acme helps engineering teams deploy frontend apps with preview deployments and rollback controls.",
        topics: [
          {
            source: "ai_suggested",
            topicName: "frontend hosting comparisons",
          },
        ],
        website: "https://acme.com",
      })
    ).resolves.toMatchObject({
      topics: expect.any(Array),
      warnings: expect.any(Array),
    })
  })
})
