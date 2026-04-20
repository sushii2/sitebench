import { beforeEach, describe, expect, it, vi } from "vitest"
import type {
  OnboardingEnhancedBrandProfile,
  OnboardingHomepageScrapeArtifact,
  OnboardingSeedBrandProfile,
} from "@/lib/onboarding/types"

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

async function loadHomepageAnalysisModule() {
  return import("@/lib/onboarding/homepage-analysis")
}

const homepageArtifact: OnboardingHomepageScrapeArtifact = {
  domain: "acme.com",
  homepageUrl: "https://www.acme.com",
  html: "<html><body><h1>Acme</h1><p>Security automation for lean SOC teams.</p></body></html>",
  markdown:
    "# Acme\n\nSecurity automation for lean SOC teams.\n\nBook a demo to automate investigations.",
  metadata: {
    sourceURL: "https://www.acme.com",
    title: "Acme",
  },
  normalizedHomepageUrl: "https://www.acme.com",
  rawFirecrawlResponse: {
    html: "<html><body><h1>Acme</h1><p>Security automation for lean SOC teams.</p></body></html>",
    markdown:
      "# Acme\n\nSecurity automation for lean SOC teams.\n\nBook a demo to automate investigations.",
    metadata: {
      sourceURL: "https://www.acme.com",
      title: "Acme",
    },
  },
}

const seedBrandProfile: OnboardingSeedBrandProfile = {
  brandName: "Acme",
  confidence: {
    audiences: 0.71,
    businessType: 0.82,
    overall: 0.8,
    pricing: 0.36,
    primaryCategory: 0.88,
    productsOrServices: 0.84,
  },
  businessType: "saas",
  conversionActions: [
    {
      action: "book a demo",
      evidence: "Book a demo to automate investigations.",
      type: "book_demo",
    },
  ],
  differentiators: [
    {
      claim: "Designed for lean SOC teams.",
      evidence: "Security automation for lean SOC teams.",
    },
  ],
  domain: "acme.com",
  homepageUrl: "https://www.acme.com",
  missingContext: ["Pricing is not stated on the homepage."],
  oneSentenceDescription:
    "Acme provides security automation software for lean SOC teams.",
  painPoints: [
    {
      evidence: "automate investigations",
      painPoint: "manual investigations",
    },
  ],
  pricingSignals: [],
  primaryCategory: "security automation",
  productsOrServices: [
    {
      description: "Security automation software for SOC teams.",
      evidence: "Security automation for lean SOC teams.",
      name: "security automation platform",
    },
  ],
  proofSignals: [],
  secondaryCategories: ["incident response automation"],
  siteVocabulary: {
    audienceTerms: ["SOC teams"],
    brandTerms: ["Acme"],
    categoryTerms: ["security automation"],
    comparisonTerms: [],
    conversionTerms: ["book a demo"],
    pricingTerms: [],
    productTerms: ["security automation"],
    proofTerms: [],
    trustTerms: [],
    useCaseTerms: ["automate investigations"],
  },
  targetAudiences: [
    {
      audience: "lean SOC teams",
      description: "Security operations teams with limited headcount.",
      evidence: "Security automation for lean SOC teams.",
    },
  ],
  trustSignals: [],
  useCases: [
    {
      description: "Automate security investigations.",
      evidence: "Book a demo to automate investigations.",
      useCase: "security investigation automation",
    },
  ],
  valuePropositions: [
    {
      claim: "Helps SOC teams automate investigations.",
      evidence: "Book a demo to automate investigations.",
    },
  ],
}

const enhancedBrandProfile: OnboardingEnhancedBrandProfile = {
  brand: {
    businessType: "saas",
    categoryConfidence: 0.9,
    domain: "acme.com",
    homepageUrl: "https://www.acme.com",
    name: "Acme",
    primaryCategory: "security automation",
  },
  buyingJourney: {
    brandAwareQueries: ["Is Acme a strong security automation platform?"],
    comparisonQueries: ["Acme vs Tines for lean SOC teams"],
    followUpQueries: ["What does Acme need for implementation?"],
    problemAwareQueries: ["How can lean SOC teams automate investigations?"],
    solutionAwareQueries: ["What security automation tools support lean SOC teams?"],
    transactionalQueries: ["Book a demo for security automation software"],
  },
  externalCategoryContext: {
    adjacentCategories: ["SOAR"],
    categoryLanguage: ["security automation", "SOAR"],
    categoryNames: ["security automation platforms"],
    commonBuyerQuestions: ["Which security automation platforms fit lean SOC teams?"],
    commonComparisonPatterns: ["Acme vs Tines"],
    substituteSolutions: ["manual playbooks"],
  },
  firstPartySummary: {
    conversionActions: ["book a demo"],
    differentiators: ["designed for lean SOC teams"],
    oneSentenceDescription:
      "Acme provides security automation software for lean SOC teams.",
    productsOrServices: ["security automation platform"],
    targetAudiences: ["lean SOC teams"],
    useCases: ["automate investigations"],
    valuePropositions: ["reduce manual security work"],
  },
  reputationContext: {
    likelyReputationQuestions: ["Is Acme reliable for SOC workflows?"],
    qualityQuestions: ["Does Acme handle complex investigations well?"],
    riskQuestions: ["What implementation risks do buyers mention for security automation tools?"],
    trustQuestions: ["Is Acme secure enough for enterprise SOC teams?"],
    valueQuestions: ["Is Acme worth the cost for lean SOC teams?"],
  },
  sourceNotes: [
    {
      claim: "Security automation is standard category language.",
      confidence: 0.86,
      sourceType: "web_search",
    },
    {
      claim: "Acme positions itself for lean SOC teams.",
      confidence: 0.92,
    sourceType: "first_party_seed",
  },
  ],
  geoPromptStrategy: {
    competitorPromptGuidance: {
      comparisonAngles: [
        "incident investigation automation depth",
        "implementation speed for lean SOC teams",
      ],
      competitorsToPrioritize: ["Tines", "Torq"],
      recommendedCompetitorPromptShare: "20-30% of prompts within the comparison cluster",
      shouldIncludeCompetitorSpecificPrompts: true,
    },
    recommendedTopicClusters: [
      {
        description:
          "Demand capture for teams evaluating security automation platforms for lean SOC operations.",
        name: "security automation evaluation",
        promptIntentsToInclude: [
          "brand_aware",
          "informational",
          "comparison",
          "recommendation",
          "constraint_based",
          "transactional",
          "reputational",
          "follow_up",
        ],
        whyThisClusterMatters:
          "It captures high-intent research from buyers moving from category education into shortlist decisions.",
      },
      {
        description:
          "Competitor-specific prompts that test when buyers name Acme alongside direct alternatives.",
        name: "competitor-specific comparisons",
        promptIntentsToInclude: [
          "comparison",
          "recommendation",
          "constraint_based",
          "reputational",
          "follow_up",
        ],
        whyThisClusterMatters:
          "It measures whether the brand appears in direct comparison and alternative-seeking queries against named competitors.",
      },
    ],
  },
  uncertainties: ["External search evidence is still thin on pricing specifics."],
}

describe("homepage analysis service", () => {
  beforeEach(() => {
    vi.resetModules()
    mockGenerateText.mockReset()
    mockGetLanguageModel.mockClear()
    mockParallelWebSearchTool.mockClear()
    mockStepCountIs.mockClear()
  })

  it("builds the seed profile with raw Firecrawl inputs in a fixed prompt order", async () => {
    mockGenerateText.mockResolvedValue({
      output: seedBrandProfile,
    })

    const { buildSeedBrandProfile } = await loadHomepageAnalysisModule()

    const result = await buildSeedBrandProfile({
      companyName: "Acme",
      homepageArtifact,
      website: "https://acme.com",
    })

    expect(result).toEqual(seedBrandProfile)
    expect(mockGetLanguageModel).toHaveBeenCalledWith("openai", {
      capability: "structuredOutput",
      modelId: "openai/gpt-5.4",
    })

    const generationCall = mockGenerateText.mock.calls[0]?.[0]
    expect(generationCall.temperature).toBe(0)
    expect(generationCall.output).toMatchObject({
      name: "onboarding_seed_brand_profile",
    })
    expect(generationCall.system).toContain("homepage brand profile specialist")
    expect(generationCall.system).toContain("no external research")
    expect(generationCall.system).toContain("no competitors")
    expect(generationCall.system).toContain("no downstream GEO strategy")
    expect(generationCall.prompt).toContain("EXACT_HOMEPAGE_URL:\nhttps://www.acme.com")
    expect(generationCall.prompt).toContain("NORMALIZED_DOMAIN:\nacme.com")
    expect(generationCall.prompt).toContain(
      `FIRECRAWL_METADATA_JSON:\n${JSON.stringify(homepageArtifact.metadata, null, 2)}`
    )
    expect(generationCall.prompt).toContain(
      `RAW_FIRECRAWL_RESPONSE_JSON:\n${JSON.stringify(homepageArtifact.rawFirecrawlResponse, null, 2)}`
    )
    expect(generationCall.prompt).toContain(
      `HOMEPAGE_MARKDOWN:\n${homepageArtifact.markdown}`
    )
    expect(generationCall.prompt).toContain(`HOMEPAGE_HTML:\n${homepageArtifact.html}`)

    const prompt = generationCall.prompt as string
    expect(prompt.indexOf("EXACT_HOMEPAGE_URL")).toBeLessThan(
      prompt.indexOf("NORMALIZED_DOMAIN")
    )
    expect(prompt.indexOf("NORMALIZED_DOMAIN")).toBeLessThan(
      prompt.indexOf("FIRECRAWL_METADATA_JSON")
    )
    expect(prompt.indexOf("FIRECRAWL_METADATA_JSON")).toBeLessThan(
      prompt.indexOf("RAW_FIRECRAWL_RESPONSE_JSON")
    )
    expect(prompt.indexOf("RAW_FIRECRAWL_RESPONSE_JSON")).toBeLessThan(
      prompt.indexOf("HOMEPAGE_MARKDOWN")
    )
    expect(prompt.indexOf("HOMEPAGE_MARKDOWN")).toBeLessThan(
      prompt.indexOf("HOMEPAGE_HTML")
    )
  })

  it("enhances the seed profile with GPT-5.4 and Parallel search", async () => {
    mockGenerateText.mockResolvedValue({
      output: enhancedBrandProfile,
    })

    const { enhanceBrandProfile } = await loadHomepageAnalysisModule()

    const result = await enhanceBrandProfile({
      companyName: "Acme",
      homepageArtifact,
      seedBrandProfile,
      website: "https://acme.com",
    })

    expect(result).toEqual(enhancedBrandProfile)
    expect(mockGetLanguageModel).toHaveBeenCalledWith("openai", {
      capability: "structuredOutput",
      modelId: "openai/gpt-5.4",
    })

    const generationCall = mockGenerateText.mock.calls[0]?.[0]
    expect(generationCall.temperature).toBe(0)
    expect(generationCall.output).toMatchObject({
      name: "onboarding_enhanced_brand_profile",
    })
    expect(generationCall.system).toContain("brand profile enhancer for GEO research")
    expect(generationCall.system).toContain("do not invent competitors")
    expect(generationCall.system).toContain("geoPromptStrategy")
    expect(generationCall.system).toContain("Return only valid JSON")
    expect(generationCall.system).toContain("Do not output markdown")
    expect(generationCall.system).toContain("Do not claim that an external fact is certain unless web evidence supports it")
    expect(generationCall.system).toContain("If competitors are ambiguous, include confidence scores and explain overlap")
    expect(generationCall.system).toContain("do not generate a page discovery plan")
    expect(generationCall.system).toContain("Call parallel_search at most once")
    expect(mockParallelWebSearchTool).toHaveBeenCalledTimes(1)
    expect(generationCall.tools).toEqual({
      parallel_search: {
        type: "parallel_search",
      },
    })
    expect(mockStepCountIs).toHaveBeenCalledWith(3)
    expect(generationCall.stopWhen).toEqual({
      count: 3,
      type: "stepCountIs",
    })
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

    const prompt = generationCall.prompt as string
    expect(prompt).toContain(
      `INPUT_BRAND_PROFILE_SEED:\n${JSON.stringify(seedBrandProfile, null, 2)}`
    )
    expect(prompt).toContain("HOMEPAGE_URL:\nhttps://www.acme.com")
    expect(prompt).toContain("NORMALIZED_DOMAIN:\nacme.com")
    expect(prompt).toContain(
      `HOMEPAGE_MARKDOWN:\n${homepageArtifact.markdown}`
    )
    expect(prompt).toContain(
      `HOMEPAGE_METADATA_JSON:\n${JSON.stringify(homepageArtifact.metadata, null, 2)}`
    )
    expect(prompt).toContain("SEARCH_PROCESS:")
    expect(prompt).toContain("Treat the seed profile as the source of truth")
    expect(prompt).toContain("Search for the brand name and domain first")
    expect(prompt).toContain("Prefer official brand pages, competitor pages")
    expect(prompt).toContain("GEO_PROMPT_STRATEGY_REQUIREMENTS:")
    expect(prompt).toContain("competitor-specific comparisons")
    expect(prompt).toContain("SEARCH_GOALS:")
    expect(prompt).not.toContain("OUTPUT_JSON_SHAPE:")
    expect(prompt.indexOf("INPUT_BRAND_PROFILE_SEED")).toBeLessThan(
      prompt.indexOf("HOMEPAGE_URL")
    )
    expect(prompt.indexOf("HOMEPAGE_URL")).toBeLessThan(
      prompt.indexOf("HOMEPAGE_MARKDOWN")
    )
    expect(prompt.indexOf("HOMEPAGE_MARKDOWN")).toBeLessThan(
      prompt.indexOf("HOMEPAGE_METADATA_JSON")
    )
    expect(prompt.indexOf("HOMEPAGE_METADATA_JSON")).toBeLessThan(
      prompt.indexOf("SEARCH_GOALS")
    )
  })

  it("falls back to GPT-5.4 without tools when search-assisted enhancement fails", async () => {
    mockGenerateText
      .mockRejectedValueOnce(new Error("Parallel search failed"))
      .mockResolvedValueOnce({
        output: enhancedBrandProfile,
      })

    const { enhanceBrandProfile } = await loadHomepageAnalysisModule()

    const result = await enhanceBrandProfile({
      companyName: "Acme",
      homepageArtifact,
      seedBrandProfile,
      website: "https://acme.com",
    })

    expect(result).toEqual(enhancedBrandProfile)
    expect(mockGetLanguageModel).toHaveBeenNthCalledWith(1, "openai", {
      capability: "structuredOutput",
      modelId: "openai/gpt-5.4",
    })
    expect(mockGetLanguageModel).toHaveBeenNthCalledWith(2, "openai", {
      capability: "structuredOutput",
      modelId: "openai/gpt-5.4",
    })
    expect(mockParallelWebSearchTool).toHaveBeenCalledTimes(1)

    const firstCall = mockGenerateText.mock.calls[0]?.[0]
    expect(firstCall.tools).toEqual({
      parallel_search: {
        type: "parallel_search",
      },
    })

    const fallbackCall = mockGenerateText.mock.calls[1]?.[0]
    expect(fallbackCall.output).toMatchObject({
      name: "onboarding_enhanced_brand_profile",
    })
    expect(fallbackCall.tools).toBeUndefined()
  })

  it("passes oversized homepage evidence through without truncation", async () => {
    mockGenerateText.mockResolvedValue({
      output: seedBrandProfile,
    })

    const { buildSeedBrandProfile } = await loadHomepageAnalysisModule()

    await buildSeedBrandProfile({
      companyName: "Acme",
      homepageArtifact: {
        ...homepageArtifact,
        html: `<html>${"H".repeat(40000)}</html>`,
        markdown: `# Acme\n\n${"M".repeat(40000)}`,
        rawFirecrawlResponse: {
          ...homepageArtifact.rawFirecrawlResponse,
          html: `<html>${"R".repeat(90000)}</html>`,
          markdown: `# Acme\n\n${"N".repeat(90000)}`,
        },
      },
      website: "https://acme.com",
    })

    const generationCall = mockGenerateText.mock.calls[0]?.[0]
    const prompt = generationCall.prompt as string

    expect(prompt).not.toContain("[truncated")
    expect(prompt).toContain(`HOMEPAGE_MARKDOWN:\n# Acme\n\n${"M".repeat(40000)}`)
    expect(prompt).toContain(`<html>${"R".repeat(90000)}</html>`)
    expect(prompt.length).toBeGreaterThan(170000)
  })
})
