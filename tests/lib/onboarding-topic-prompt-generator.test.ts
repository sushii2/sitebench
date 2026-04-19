import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGenerateText = vi.fn()
const mockGetLanguageModel = vi.fn(
  (_providerId: string, options?: { capability?: string }) => ({
    capability: options?.capability ?? "default",
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
  }
})

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
  })

  it("generates prompts from the new goal/category/persona/constraint/context formula", async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        topics: [
          {
            prompts: [
              {
                category: "security automation platform",
                constraint: "must integrate with Okta and Snowflake without a six-month rollout",
                context:
                  "Acme sells security automation products for enterprise security and compliance teams in North America.",
                goal: "compare leading vendors",
                persona: "security operations leader",
                promptText:
                  "Which security automation platforms should a security operations leader compare when they need Okta and Snowflake integrations without a six-month rollout?",
                variantType: "comparison",
              },
              {
                category: "security automation platform",
                constraint: "needs clear ROI and implementation confidence",
                context:
                  "Acme sells security automation products for enterprise security and compliance teams in North America.",
                goal: "build a shortlist",
                persona: "security operations leader",
                promptText:
                  "What security automation platforms should a security operations leader shortlist when they need clear ROI and low implementation risk?",
                variantType: "discovery",
              },
            ],
            topicName: "security automation platforms",
          },
        ],
      },
    })

    const { generateTopicPromptCollection } = await loadGeneratorModule()

    const result = await generateTopicPromptCollection({
      analysisRunId: "analysis-1",
      brandProfile: {
        careers: "Hiring in security engineering and GTM roles.",
        categories: ["security automation", "compliance automation"],
        detailedDescription:
          "Acme helps enterprise security and compliance teams automate investigations, orchestration, and evidence collection.",
        geography: "North America",
        jobsToBeDone: [
          "automate security investigations",
          "reduce audit prep effort",
        ],
        keywords: ["SOAR", "security automation", "compliance automation"],
        pricing: "enterprise SaaS with demo-led sales",
        primaryCategory: "security automation",
        primarySubcategory: "security automation platform",
        products: ["incident response automation", "compliance workflows"],
        siteArchetype: "saas",
        targetCustomers: ["security operations leaders", "compliance teams"],
        warnings: [],
      },
      companyName: "Acme",
      competitors: [
        { name: "Tines", website: "https://tines.com" },
        { name: "Torq", website: "https://torq.io" },
      ],
      description:
        "Acme helps enterprise security teams automate investigations and compliance workflows.",
      topics: [
        {
          intentSummary:
            "Buyer evaluation of security automation platforms for enterprise teams.",
          source: "ai_suggested",
          sourceUrls: [
            "https://acme.com/platform",
            "https://acme.com/integrations",
          ],
          topicName: "security automation platforms",
        },
      ],
      website: "https://acme.com",
    })

    expect(mockGetLanguageModel).toHaveBeenCalledWith("openai", {
      capability: "structuredOutput",
    })
    const generationCall = mockGenerateText.mock.calls[0]?.[0]
    expect(generationCall.system).toContain(
      "goal + category + persona + constraint + context"
    )
    expect(generationCall.system).toContain(
      "AI Gateway structured-output contract"
    )
    expect(generationCall.system).toContain("Never omit a schema key.")
    expect(generationCall.output).toMatchObject({
      description: expect.stringContaining("topic-specific onboarding prompts"),
      name: "onboarding_topic_prompt_collection",
    })
    expect(generationCall.prompt).toContain("Site archetype: saas")
    expect(generationCall.prompt).toContain(
      "Primary category: security automation"
    )
    expect(generationCall.prompt).toContain(
      "Jobs to be done: automate security investigations"
    )
    expect(generationCall.prompt).toContain(
      "Topic 1: security automation platforms"
    )

    const prompts = result.topics[0]?.prompts ?? []
    expect(prompts).toHaveLength(2)
    expect(prompts[0]?.scoreStatus).toBe("unscored")
    expect(prompts[0]?.scoreMetadata).toMatchObject({
      category: "security automation platform",
      constraint:
        "must integrate with Okta and Snowflake without a six-month rollout",
      goal: "compare leading vendors",
      persona: "security operations leader",
      context: expect.stringContaining("North America"),
    })
    expect(prompts[0]?.promptText).toMatch(/security automation platforms/i)
  })

  it("falls back to deterministic prompt templates when structured generation fails", async () => {
    mockGenerateText.mockRejectedValue(new Error("provider unavailable"))

    const { generateTopicPromptCollection } = await loadGeneratorModule()

    const result = await generateTopicPromptCollection({
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

    expect(
      result.topics[0]?.prompts.some((prompt) =>
        /frontend hosting comparisons/i.test(prompt.promptText)
      )
    ).toBe(true)
    expect(result.warnings).toContain(
      "We could not fully tailor prompt suggestions, so we used a lighter fallback."
    )
  })
})
