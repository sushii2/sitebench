import { asSchema } from "ai"
import { describe, expect, it } from "vitest"

import {
  onboardingAnalysisStartResponseSchema,
  onboardingBrandProfileSchema,
  onboardingCatalogSchema,
  onboardingCompetitorRecoverySchema,
  onboardingCompetitorScoringPayloadSchema,
  onboardingCriticalPageSelectionSchema,
  onboardingEnhancedBrandProfileSchema,
  onboardingGatewayBrandProfileSchema,
  onboardingGatewayCatalogSchema,
  onboardingGatewayCriticalPageSelectionSchema,
  onboardingGatewayEnhancedBrandProfileSchema,
  onboardingGatewayHomepageClassificationSchema,
  onboardingGatewaySeedBrandProfileSchema,
  onboardingGatewayTopicClusterSchema,
  onboardingHomepageClassificationSchema,
  onboardingPromptIntentSchema,
  onboardingPromptFormulaPayloadSchema,
  onboardingSeedBrandProfileSchema,
  onboardingTopicPromptRequestSchema,
} from "@/lib/onboarding/types"

function collectGatewaySchemaIssues(
  schema: Record<string, unknown>,
  path = "$"
): string[] {
  const issues: string[] = []
  const type = schema.type

  if (typeof schema.format === "string") {
    issues.push(`${path} must not declare format=${schema.format}`)
  }

  if (type === "object") {
    const properties = (schema.properties ?? {}) as Record<string, unknown>
    const propertyKeys = Object.keys(properties)
    const required = Array.isArray(schema.required)
      ? [...schema.required].sort()
      : null
    const expectedRequired = [...propertyKeys].sort()

    if (schema.additionalProperties !== false) {
      issues.push(`${path} must set additionalProperties=false`)
    }

    if (
      required === null ||
      JSON.stringify(required) !== JSON.stringify(expectedRequired)
    ) {
      issues.push(
        `${path} must require every property. expected=${expectedRequired.join(",")} actual=${required?.join(",") ?? "(missing)"}`
      )
    }

    for (const [key, value] of Object.entries(properties)) {
      issues.push(
        ...collectGatewaySchemaIssues(
          value as Record<string, unknown>,
          `${path}.${key}`
        )
      )
    }
  }

  if (type === "array" && schema.items && typeof schema.items === "object") {
    issues.push(
      ...collectGatewaySchemaIssues(
        schema.items as Record<string, unknown>,
        `${path}[]`
      )
    )
  }

  if (Array.isArray(schema.anyOf)) {
    for (const [index, branch] of schema.anyOf.entries()) {
      if (branch && typeof branch === "object") {
        issues.push(
          ...collectGatewaySchemaIssues(
            branch as Record<string, unknown>,
            `${path}.anyOf[${index}]`
          )
        )
      }
    }
  }

  return issues
}

describe("onboarding structured output schemas", () => {
  it("requires every competitor field for recovery candidates", () => {
    const result = onboardingCompetitorRecoverySchema.safeParse({
      competitors: [{ name: "Competitor 1" }],
    })

    expect(result.success).toBe(false)
  })

  it("accepts homepage classification output with archetype-aware fields", () => {
    const result = onboardingHomepageClassificationSchema.safeParse({
      buyerLanguage: ["lightweight", "trail-ready", "wide toe box"],
      categories: ["running shoes", "athletic apparel"],
      pageEquivalentPatterns: ["women", "men", "shoes", "sale"],
      personas: ["runners", "gift buyers"],
      pricingModel: "mid-market retail",
      primaryCategory: "running shoes",
      primarySubcategory: "trail running shoes",
      secondaryCategories: ["athletic apparel"],
      siteArchetype: "ecommerce",
    })

    expect(result.success).toBe(true)
  })

  it("accepts critical-page selection output with page roles", () => {
    const result = onboardingCriticalPageSelectionSchema.safeParse({
      pages: [
        {
          expectedSignals: ["taxonomy breadth", "merchandising language"],
          pageRole: "category_hub",
          priority: 1,
          url: "https://acme.com/women/shoes",
          whySelected: "Represents the core women and shoes merchandising hubs.",
        },
      ],
    })

    expect(result.success).toBe(true)
  })

  it("accepts an expanded brand profile for archetype-aware onboarding", () => {
    const result = onboardingBrandProfileSchema.safeParse({
      careers: "Hiring in logistics and retail operations across the US.",
      categories: ["running shoes", "athletic apparel"],
      comparisonSets: [
        "trail running shoes vs hiking shoes",
        "brooks vs hoka",
      ],
      conversionMoments: ["buy trail shoes for a spring race"],
      detailedDescription:
        "Acme sells running footwear and apparel for runners who compare fit, durability, and price.",
      differentiators: ["wide-fit assortment", "terrain-specific filters"],
      evidenceUrls: [
        "https://acme.com/collections/trail-running",
        "https://acme.com/pages/shipping",
      ],
      geography: "United States and Canada",
      jobsToBeDone: ["find running shoes by terrain", "shop by fit"],
      keywords: ["running shoes", "trail shoes", "wide fit"],
      pricing: "mid-market retail pricing",
      primaryCategory: "running shoes",
      primarySubcategory: "trail running shoes",
      products: ["trail shoes", "road shoes", "running apparel"],
      reputationalQuestions: ["Is Acme worth the price for trail runners?"],
      researchJourneys: [
        "compare trail running shoes by terrain and fit",
      ],
      secondaryCategories: ["athletic apparel"],
      siteArchetype: "ecommerce",
      targetAudiences: ["gift buyers"],
      targetCustomers: ["runners", "gift buyers"],
      warnings: [],
    })

    expect(result.success).toBe(true)
  })

  it("accepts the canonical GEO prompt catalog schema", () => {
    const result = onboardingCatalogSchema.safeParse({
      brand: "Acme",
      businessType: "services",
      domain: "acme.com",
      primaryCategory: "fractional CFO services",
      topics: [
        {
          description:
            "Commercial and evaluation queries for outsourced finance leadership.",
          id: "fractional-cfo-services",
          name: "fractional cfo services",
          prompts: [
            {
              id: "fractional-cfo-services-1",
              intent: "recommendation",
              text: "What are the best fractional CFO services for SaaS startups preparing for a Series A?",
            },
            {
              id: "fractional-cfo-services-2",
              intent: "constraint_based",
              text: "Which fractional CFO firms help B2B SaaS teams clean up board reporting in under 60 days?",
            },
          ],
        },
      ],
    })

    expect(result.success).toBe(true)
  })

  it("defaults topic prompt refresh requests to full catalog refresh mode", () => {
    const result = onboardingTopicPromptRequestSchema.parse({
      analysisRunId: "analysis-1",
      companyName: "Acme",
      competitors: [],
      description: "Acme provides finance support for SaaS teams.",
      website: "https://acme.com",
    })

    expect(result).toMatchObject({
      excludedPromptTexts: [],
      excludedTopicNames: [],
      mode: "full_refresh",
      topics: [],
    })
  })

  it("accepts the canonical prompt intent set", () => {
    for (const value of [
      "brand_aware",
      "informational",
      "comparison",
      "recommendation",
      "constraint_based",
      "transactional",
      "local",
      "reputational",
      "follow_up",
    ]) {
      expect(onboardingPromptIntentSchema.safeParse(value).success).toBe(true)
    }
  })

  it("accepts competitor scoring payloads with weighted factors", () => {
    const result = onboardingCompetitorScoringPayloadSchema.safeParse({
      competitors: [
        {
          buyerOverlap: 0.8,
          categoryOverlap: 0.95,
          geoSimilarity: 0.6,
          keywordOverlap: 0.9,
          name: "Competitor 1",
          pricingSimilarity: 0.7,
          totalScore: 0.86,
          website: "https://competitor-1.com",
          whySelected: "Matches category, buyer, and pricing signals.",
        },
      ],
    })

    expect(result.success).toBe(true)
  })

  it("accepts homepage seed and enhancement outputs for the homepage-only analysis flow", () => {
    const seedResult = onboardingSeedBrandProfileSchema.safeParse({
      brandName: "Acme",
      confidence: {
        audiences: 0.7,
        businessType: 0.82,
        overall: 0.8,
        pricing: 0.3,
        primaryCategory: 0.9,
        productsOrServices: 0.86,
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
          claim: "Built for lean SOC teams.",
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
    })

    const enhancedResult = onboardingEnhancedBrandProfileSchema.safeParse({
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
        solutionAwareQueries: [
          "What security automation tools support lean SOC teams?",
        ],
        transactionalQueries: ["Book a demo for security automation software"],
      },
      externalCategoryContext: {
        adjacentCategories: ["SOAR"],
        categoryLanguage: ["security automation", "SOAR"],
        categoryNames: ["security automation platforms"],
        commonBuyerQuestions: [
          "Which security automation platforms fit lean SOC teams?",
        ],
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
        riskQuestions: [
          "What implementation risks do buyers mention for security automation tools?",
        ],
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
          recommendedCompetitorPromptShare:
            "20-30% of prompts within the comparison cluster",
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
    })

    expect(seedResult.success).toBe(true)
    expect(enhancedResult.success).toBe(true)
  })

  it("accepts the homepage-only seeding and enhancing workflow phases", () => {
    expect(
      onboardingAnalysisStartResponseSchema.safeParse({
        analysisId: "analysis-1",
        status: "seeding",
        warnings: [],
      }).success
    ).toBe(true)

    expect(
      onboardingAnalysisStartResponseSchema.safeParse({
        analysisId: "analysis-1",
        status: "enhancing",
        warnings: [],
      }).success
    ).toBe(true)
  })

  it("accepts prompt formula payloads grounded in goal, category, persona, constraint, and context", () => {
    const result = onboardingPromptFormulaPayloadSchema.safeParse({
      topics: [
        {
          prompts: [
            {
              category: "trail running shoes",
              constraint: "needs wide-fit options under $180",
              context: "Acme sells trail and road shoes across North America.",
              goal: "discover reputable options",
              persona: "runner training for an ultramarathon",
              promptText:
                "What are the best trail running shoes for a runner training for an ultramarathon who needs wide-fit options under $180 in North America?",
              variantType: "discovery",
            },
          ],
          topicName: "trail running shoes",
        },
      ],
    })

    expect(result.success).toBe(true)
  })

  it("exports gateway-safe schemas that require every object property", async () => {
    const gatewaySchemas = {
      onboardingGatewayBrandProfileSchema,
      onboardingGatewayCatalogSchema,
      onboardingGatewayCriticalPageSelectionSchema,
      onboardingGatewayEnhancedBrandProfileSchema,
      onboardingGatewayHomepageClassificationSchema,
      onboardingGatewaySeedBrandProfileSchema,
      onboardingGatewayTopicClusterSchema,
    }

    for (const [schemaName, schema] of Object.entries(
      gatewaySchemas
    ) as Array<[string, Parameters<typeof asSchema>[0]]>) {
      expect(schema, `${schemaName} must be exported`).toBeDefined()

      const jsonSchema = (await asSchema(schema).jsonSchema) as Record<string, unknown>
      const issues = collectGatewaySchemaIssues(jsonSchema)

      expect(
        issues,
        `${schemaName} must satisfy the AI Gateway structured-output requirements`
      ).toEqual([])
    }
  })

  it("keeps competitors out of the seed and enhance schemas while allowing GEO strategy on enhance only", async () => {
    const seedJsonSchema = (await asSchema(onboardingGatewaySeedBrandProfileSchema)
      .jsonSchema) as {
      properties?: Record<string, unknown>
    }
    const enhanceJsonSchema = (
      await asSchema(onboardingGatewayEnhancedBrandProfileSchema).jsonSchema
    ) as {
      properties?: Record<string, unknown>
    }

    expect(seedJsonSchema.properties).not.toHaveProperty("competitors")
    expect(seedJsonSchema.properties).not.toHaveProperty("geoPromptStrategy")
    expect(seedJsonSchema.properties).not.toHaveProperty("pageDiscoveryPlan")
    expect(enhanceJsonSchema.properties).not.toHaveProperty("competitors")
    expect(enhanceJsonSchema.properties).toHaveProperty("geoPromptStrategy")
    expect(enhanceJsonSchema.properties).not.toHaveProperty("pageDiscoveryPlan")
  })
})
