import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGenerateText = vi.fn()
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
  }
})

vi.mock("@/lib/ai/provider-config", () => ({
  getLanguageModel: mockGetLanguageModel,
}))

async function loadGeneratorModule() {
  return import("@/lib/onboarding/topic-prompt-generator")
}

function makeCatalog() {
  return {
    brand: "Acme",
    businessType: "saas",
    domain: "acme.com",
    primaryCategory: "security automation",
    topics: [
      {
        description:
          "Commercial discovery and vendor-evaluation prompts for security automation.",
        id: "security-automation-platforms",
        name: "security automation platforms",
        prompts: [
          {
            id: "security-automation-platforms-1",
            intent: "recommendation" as const,
            text: "What security automation platforms do enterprise SOC teams recommend for incident triage?",
          },
          {
            id: "security-automation-platforms-2",
            intent: "comparison" as const,
            text: "How do security automation platforms compare for teams that need Okta and Snowflake integrations?",
          },
          {
            id: "security-automation-platforms-3",
            intent: "follow_up" as const,
            text: "Which security automation vendors are easiest to roll out after a SOC team has already shortlisted Tines and Torq?",
          },
        ],
      },
      {
        description:
          "Reputation and implementation prompts for buyers validating vendor fit.",
        id: "security-automation-reputation",
        name: "security automation reputation",
        prompts: [
          {
            id: "security-automation-reputation-1",
            intent: "brand_aware" as const,
            text: "Is Acme a credible security automation vendor for enterprise compliance teams?",
          },
          {
            id: "security-automation-reputation-2",
            intent: "reputational" as const,
            text: "What do buyers say about the reliability of security automation platforms for audit evidence collection?",
          },
          {
            id: "security-automation-reputation-3",
            intent: "constraint_based" as const,
            text: "Which security automation tools help lean compliance teams reduce audit prep without a six-month rollout?",
          },
        ],
      },
    ],
  }
}

describe("generateTopicPromptCollection", () => {
  beforeEach(() => {
    vi.resetModules()
    mockGenerateText.mockReset()
    mockGetLanguageModel.mockClear()
  })

  it("generates a unified catalog from scraped page signals and returns derived topic drafts", async () => {
    mockGenerateText.mockResolvedValue({
      output: makeCatalog(),
    })

    const { generateTopicPromptCollection } = await loadGeneratorModule()

    const result = await generateTopicPromptCollection({
      analysisRunId: "analysis-1",
      brandProfile: {
        careers: "Hiring in security engineering and GTM roles.",
        categories: ["security automation", "compliance automation"],
        comparisonSets: ["Acme vs Tines", "Acme vs Torq"],
        conversionMoments: ["book a demo for a SOC automation rollout"],
        detailedDescription:
          "Acme helps enterprise security and compliance teams automate investigations, orchestrate alerts, and collect audit evidence.",
        differentiators: ["deep audit evidence workflows", "SOC-first integrations"],
        evidenceUrls: [
          "https://acme.com/platform",
          "https://acme.com/integrations",
        ],
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
        reputationalQuestions: [
          "Is Acme secure enough for regulated enterprise teams?",
        ],
        researchJourneys: [
          "compare SOAR vendors by implementation effort and audit readiness",
        ],
        secondaryCategories: ["compliance automation"],
        siteArchetype: "saas",
        targetAudiences: ["security leaders", "compliance managers"],
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
      geoPromptStrategy: {
        competitorPromptGuidance: {
          comparisonAngles: ["implementation speed", "integration depth"],
          competitorsToPrioritize: ["Tines", "Torq"],
          recommendedCompetitorPromptShare:
            "20-30% of prompts within the comparison cluster",
          shouldIncludeCompetitorSpecificPrompts: true,
        },
        recommendedTopicClusters: [
          {
            description:
              "High-intent evaluation prompts for security automation platforms.",
            name: "security automation evaluation",
            promptIntentsToInclude: [
              "informational",
              "comparison",
              "recommendation",
              "constraint_based",
              "transactional",
            ],
            whyThisClusterMatters:
              "Captures buyers moving from category education into vendor selection.",
          },
          {
            description:
              "Direct competitor prompts for buyers comparing Acme with named alternatives.",
            name: "competitor-specific comparisons",
            promptIntentsToInclude: [
              "comparison",
              "recommendation",
              "constraint_based",
              "reputational",
              "follow_up",
            ],
            whyThisClusterMatters:
              "Measures whether the brand appears when buyers ask for named alternatives.",
          },
        ],
      },
      generationConfig: {
        promptsPerTopic: 3,
        topicCountRange: {
          max: 2,
          min: 2,
        },
      },
      scrapedPages: [
        {
          competitorCandidates: [
            { name: "Tines", website: "https://tines.com" },
            { name: "Torq", website: "https://torq.io" },
          ],
          contentSnapshot:
            "Security automation platform with audit evidence workflows, Okta integrations, and enterprise rollout guidance.",
          entities: ["audit evidence", "SOC workflows", "Okta", "Snowflake"],
          evidenceSnippets: [
            "Automate evidence collection for audits.",
            "Integrates with Okta and Snowflake.",
          ],
          intents: ["vendor comparison", "implementation planning"],
          pageType: "product_hub",
          title: "Security automation platform",
          url: "https://acme.com/platform",
        },
      ],
      topics: [
        {
          source: "user_added",
          topicName: "security automation reputation",
        },
      ],
      website: "https://acme.com",
    })

    expect(mockGetLanguageModel).toHaveBeenCalledWith("openai", {
      capability: "structuredOutput",
      modelId: "openai/gpt-5.4",
    })
    const generationCall = mockGenerateText.mock.calls[0]?.[0]
    expect(generationCall.output).toMatchObject({
      description: expect.stringContaining("GEO prompt starter catalog"),
      name: "onboarding_geo_prompt_catalog",
    })
    expect(generationCall.system).toContain("Generate exactly 3 prompts per topic.")
    expect(generationCall.prompt).toContain("Locked topic names: security automation reputation")
    expect(generationCall.prompt).toContain("URL: https://acme.com/platform")
    expect(generationCall.prompt).toContain("Competitor candidates: Tines, Torq")
    expect(generationCall.prompt).toContain("Geo prompt strategy guidance:")
    expect(generationCall.prompt).toContain("competitor-specific comparisons")
    expect(generationCall.prompt).toContain(
      "Recommended competitor prompt share: 20-30% of prompts within the comparison cluster"
    )

    expect(result.catalog).toMatchObject({
      brand: "Acme",
      businessType: "saas",
      domain: "acme.com",
      primaryCategory: "security automation",
    })
    expect(result.topics).toHaveLength(2)
    expect(result.topics[0]).toMatchObject({
      source: "ai_suggested",
      topicDescription:
        "Commercial discovery and vendor-evaluation prompts for security automation.",
      topicName: "security automation platforms",
    })
    expect(result.topics[1]).toMatchObject({
      source: "user_added",
      topicDescription:
        "Reputation and implementation prompts for buyers validating vendor fit.",
      topicName: "security automation reputation",
    })
    expect(result.topics[0]?.prompts[0]).toMatchObject({
      addedVia: "ai_suggested",
      intent: "recommendation",
      promptText:
        "What security automation platforms do enterprise SOC teams recommend for incident triage?",
      scoreMetadata: {
        generation: expect.objectContaining({
          businessType: "saas",
          primaryCategory: "security automation",
          topicId: "security-automation-platforms",
        }),
      },
      scoreStatus: "unscored",
      sourceAnalysisRunId: "analysis-1",
    })
  })

  it("retries once when the model returns the wrong prompt count", async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        output: {
          ...makeCatalog(),
          topics: [
            {
              ...makeCatalog().topics[0],
              prompts: makeCatalog().topics[0]?.prompts.slice(0, 2) ?? [],
            },
            makeCatalog().topics[1],
          ],
        },
      })
      .mockResolvedValueOnce({
        output: makeCatalog(),
      })

    const { generateTopicPromptCollection } = await loadGeneratorModule()

    const result = await generateTopicPromptCollection({
      analysisRunId: "analysis-1",
      companyName: "Acme",
      competitors: [],
      description: "Description",
      generationConfig: {
        promptsPerTopic: 3,
        topicCountRange: {
          max: 2,
          min: 2,
        },
      },
      scrapedPages: [
        {
          competitorCandidates: [],
          contentSnapshot: "Acme helps SOC teams automate investigations.",
          entities: ["SOC"],
          evidenceSnippets: ["Automate investigations"],
          intents: ["vendor discovery"],
          pageType: "homepage",
          title: "Acme",
          url: "https://acme.com",
        },
      ],
      website: "https://acme.com",
    })

    expect(mockGenerateText).toHaveBeenCalledTimes(2)
    expect(result.catalog.topics).toHaveLength(2)
    expect(result.topics[0]?.prompts).toHaveLength(3)
  })

  it("throws a clear error when catalog generation still fails after one retry", async () => {
    mockGenerateText
      .mockResolvedValueOnce({
        output: {
          ...makeCatalog(),
          topics: [
            {
              ...makeCatalog().topics[0],
              prompts: makeCatalog().topics[0]?.prompts.slice(0, 2) ?? [],
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        output: {
          ...makeCatalog(),
          topics: [
            {
              ...makeCatalog().topics[0],
              prompts: makeCatalog().topics[0]?.prompts.slice(0, 2) ?? [],
            },
          ],
        },
      })

    const { generateTopicPromptCollection } = await loadGeneratorModule()

    await expect(
      generateTopicPromptCollection({
        analysisRunId: "analysis-1",
        companyName: "Acme",
        competitors: [],
        description: "Description",
        generationConfig: {
          promptsPerTopic: 3,
          topicCountRange: {
            max: 2,
            min: 2,
          },
        },
        scrapedPages: [
          {
            competitorCandidates: [],
            contentSnapshot: "Acme helps SOC teams automate investigations.",
            entities: ["SOC"],
            evidenceSnippets: ["Automate investigations"],
            intents: ["vendor discovery"],
            pageType: "homepage",
            title: "Acme",
            url: "https://acme.com",
          },
        ],
        website: "https://acme.com",
      })
    ).rejects.toThrow(
      "Unable to generate a valid onboarding GEO catalog after 2 attempts."
    )
  })
})
