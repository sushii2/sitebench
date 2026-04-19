import { asSchema } from "ai"
import { describe, expect, it } from "vitest"

import {
  onboardingBrandProfileSchema,
  onboardingCatalogSchema,
  onboardingCompetitorRecoverySchema,
  onboardingCompetitorScoringPayloadSchema,
  onboardingCriticalPageSelectionSchema,
  onboardingGatewayBrandProfileSchema,
  onboardingGatewayCatalogSchema,
  onboardingGatewayCriticalPageSelectionSchema,
  onboardingGatewayHomepageClassificationSchema,
  onboardingGatewayTopicClusterSchema,
  onboardingHomepageClassificationSchema,
  onboardingPromptIntentSchema,
  onboardingPromptFormulaPayloadSchema,
  onboardingTopicPromptRequestSchema,
} from "@/lib/onboarding/types"

function collectGatewaySchemaIssues(
  schema: Record<string, unknown>,
  path = "$"
): string[] {
  const issues: string[] = []
  const type = schema.type

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
      onboardingGatewayHomepageClassificationSchema,
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
})
