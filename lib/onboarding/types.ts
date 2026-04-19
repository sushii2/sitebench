import { jsonSchema } from "ai"
import { z } from "zod"

import type { TopicSource } from "@/lib/project-topics/types"
import type {
  TrackedPromptAddedVia,
  TrackedPromptScoreStatus,
  TrackedPromptVariantType,
} from "@/lib/tracked-prompts/types"

export const onboardingPromptVariantValues = [
  "discovery",
  "comparison",
  "alternatives",
  "pricing",
  "implementation",
  "use_case",
  "migration",
  "roi",
  "integration",
  "competitor_specific",
] as const

export const onboardingPromptIntentValues = [
  "brand_aware",
  "informational",
  "comparison",
  "recommendation",
  "constraint_based",
  "transactional",
  "local",
  "reputational",
  "follow_up",
] as const

export const onboardingPromptIntentTypeValues = [
  "category_discovery",
  "recommendation",
  "comparison",
  "alternatives",
  "problem_solving",
  "best_practices",
  "pricing",
  "implementation",
] as const

export const onboardingPromptPurchaseStageValues = [
  "discovery",
  "consideration",
  "decision",
] as const

export const onboardingPromptBrandRelevanceValues = [
  "direct",
  "indirect",
  "adjacent",
] as const

export const onboardingPromptCommercialValueValues = [
  "high",
  "medium",
  "low",
] as const

export const onboardingSiteArchetypeValues = [
  "ecommerce",
  "saas",
  "marketplace",
  "services",
  "media",
  "developer_tool",
  "multi_product",
] as const

export const onboardingWorkflowPhaseValues = [
  "mapping",
  "classifying",
  "planning",
  "scraping",
  "profiling",
  "competitors",
  "prompting",
  "completed",
  "failed",
] as const

export const onboardingPageRoleValues = [
  "homepage",
  "pricing",
  "product_hub",
  "category_hub",
  "solution_page",
  "integration_page",
  "proof_page",
  "comparison_page",
  "geography_page",
  "careers_page",
  "editorial_page",
  "other",
] as const

export const onboardingMappedCandidateBucketValues = [
  "homepage",
  "pricing",
  "product_hub",
  "category_hub",
  "solution_page",
  "integration_page",
  "comparison_page",
  "proof_page",
  "about",
  "careers",
  "editorial",
  "geography",
  "product_detail",
  "utility",
] as const

export const onboardingBrandRequestSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required"),
  website: z.string().trim().min(1, "Website is required"),
})

export const onboardingCompetitorSchema = z.object({
  name: z.string().trim().min(1),
  website: z.string().trim().min(1),
})

export const onboardingBrandResponseSchema = z.object({
  description: z.string(),
  topics: z.array(z.string()),
  competitors: z.array(onboardingCompetitorSchema),
  warnings: z.array(z.string()),
})

export const onboardingAiSuggestionSchema = z.object({
  description: z.string(),
  topics: z.array(z.string()),
  competitors: z.array(onboardingCompetitorSchema),
})

export const onboardingCompetitorRecoverySchema = z.object({
  competitors: z.array(onboardingCompetitorSchema),
})

export const onboardingScrapeContextSchema = z.object({
  html: z.string(),
  url: z.string().url(),
  markdown: z.string(),
})

export const onboardingTopicSourceSchema = z.enum([
  "user_added",
  "ai_suggested",
  "system_seeded",
])

export const onboardingPromptAddedViaSchema = z.enum([
  "user_selected",
  "user_created",
  "ai_suggested",
  "system_seeded",
])

export const onboardingPromptIntentSchema = z.enum(
  onboardingPromptIntentValues
)

export const onboardingPromptGenerationMetadataSchema = z.object({
  brand: z.string().trim().min(1),
  businessType: z.string().trim().min(1),
  domain: z.string().trim().min(1),
  evidenceUrls: z.array(z.string().trim().min(1)).default([]),
  primaryCategory: z.string().trim().min(1),
  sourceUrls: z.array(z.string().trim().min(1)).default([]),
  topicDescription: z.string().trim().default(""),
  topicId: z.string().trim().min(1),
  topicName: z.string().trim().min(1),
})

export const onboardingPromptDraftSchema = z.object({
  addedVia: onboardingPromptAddedViaSchema,
  generationMetadata: onboardingPromptGenerationMetadataSchema.optional(),
  intent: onboardingPromptIntentSchema.optional(),
  pqsRank: z.number().int().positive().optional(),
  pqsScore: z.number().min(0).max(100).optional(),
  promptText: z.string().trim().min(1, "Prompt text is required"),
  scoreMetadata: z.record(z.string(), z.unknown()).default({}).optional(),
  scoreStatus: z.enum(["scored", "stale", "unscored"]).default("unscored").optional(),
  sourceAnalysisRunId: z.string().trim().min(1).optional(),
  templateText: z.string().trim().min(1).optional(),
  variantType: z.enum(onboardingPromptVariantValues).optional(),
})

export const onboardingTopicInputSchema = z.object({
  clusterId: z.string().trim().min(1).optional(),
  intentSummary: z.string().trim().min(1).optional(),
  source: onboardingTopicSourceSchema,
  sourceUrls: z.array(z.string().trim().min(1)).default([]).optional(),
  topicName: z.string().trim().min(1, "Topic name is required"),
})

export const onboardingTopicDraftSchema = onboardingTopicInputSchema.extend({
  prompts: z.array(onboardingPromptDraftSchema),
  topicDescription: z.string().trim().default("").optional(),
  topicId: z.string().trim().min(1).optional(),
})

export const onboardingAnalysisRequestSchema = z.object({
  projectId: z.string().trim().min(1, "Project ID is required"),
  companyName: z.string().trim().min(1, "Company name is required"),
  website: z.string().trim().min(1, "Website is required"),
})

export const onboardingHomepageClassificationSchema = z.object({
  buyerLanguage: z.array(z.string().trim().min(1)).default([]),
  categories: z.array(z.string().trim().min(1)).min(1),
  pageEquivalentPatterns: z.array(z.string().trim().min(1)).default([]),
  personas: z.array(z.string().trim().min(1)).default([]),
  pricingModel: z.string().trim().min(1),
  primaryCategory: z.string().trim().min(1),
  primarySubcategory: z.string().trim().default(""),
  secondaryCategories: z.array(z.string().trim().min(1)).default([]),
  siteArchetype: z.enum(onboardingSiteArchetypeValues),
})

export const onboardingCriticalPageSelectionItemSchema = z.object({
  expectedSignals: z.array(z.string().trim().min(1)).default([]),
  pageRole: z.enum(onboardingPageRoleValues),
  priority: z.number().int().positive(),
  url: z.string().trim().min(1),
  whySelected: z.string().trim().min(1),
})

export const onboardingCriticalPageSelectionSchema = z.object({
  pages: z.array(onboardingCriticalPageSelectionItemSchema).min(1),
})

export const onboardingPageSignalSchema = z.object({
  competitorCandidates: z.array(onboardingCompetitorSchema).default([]),
  confidence: z.number().min(0).max(1),
  entities: z.array(z.string().trim().min(1)).default([]),
  evidenceSnippets: z.array(z.string().trim().min(1)).default([]),
  intents: z.array(z.string().trim().min(1)).default([]),
  pageType: z.enum(onboardingPageRoleValues),
  url: z.string().trim().min(1),
})

export const onboardingPageSignalBatchSchema = z.object({
  pages: z.array(onboardingPageSignalSchema),
})

export const onboardingBrandProfileSchema = z.object({
  careers: z.string().trim().nullable(),
  categories: z.array(z.string().trim().min(1)).min(1),
  comparisonSets: z.array(z.string().trim().min(1)).default([]),
  conversionMoments: z.array(z.string().trim().min(1)).default([]),
  detailedDescription: z.string().trim().min(1),
  differentiators: z.array(z.string().trim().min(1)).default([]),
  evidenceUrls: z.array(z.string().trim().min(1)).default([]),
  geography: z.string().trim().nullable(),
  jobsToBeDone: z.array(z.string().trim().min(1)).default([]),
  keywords: z.array(z.string().trim().min(1)).default([]),
  pricing: z.string().trim().min(1),
  primaryCategory: z.string().trim().min(1),
  primarySubcategory: z.string().trim().default(""),
  products: z.array(z.string().trim().min(1)).default([]),
  reputationalQuestions: z.array(z.string().trim().min(1)).default([]),
  researchJourneys: z.array(z.string().trim().min(1)).default([]),
  secondaryCategories: z.array(z.string().trim().min(1)).default([]),
  siteArchetype: z.enum(onboardingSiteArchetypeValues),
  targetAudiences: z.array(z.string().trim().min(1)).default([]),
  targetCustomers: z.array(z.string().trim().min(1)).default([]),
  warnings: z.array(z.string()).default([]),
})

export const onboardingTopicClusterSchema = z.object({
  topics: z.array(
    onboardingTopicDraftSchema.omit({
      prompts: true,
      topicId: true,
    })
  ),
})

function createGatewayValidatedSchema<OBJECT>(
  schemaDefinition: Record<string, unknown>,
  validator: z.ZodType<OBJECT>
) {
  return jsonSchema<OBJECT>(schemaDefinition, {
    validate(value) {
      const result = validator.safeParse(value)

      if (result.success) {
        return {
          success: true as const,
          value: result.data,
        }
      }

      const message = result.error.issues
        .map((issue) => {
          const path = issue.path.length > 0 ? issue.path.join(".") : "$"

          return `${path}: ${issue.message}`
        })
        .join("; ")

      return {
        success: false as const,
        error: new Error(message),
      }
    },
  })
}

const onboardingGatewayHomepageClassificationValidationSchema = z.object({
  buyerLanguage: z.array(z.string().trim().min(1)),
  categories: z.array(z.string().trim().min(1)).min(1),
  pageEquivalentPatterns: z.array(z.string().trim().min(1)),
  personas: z.array(z.string().trim().min(1)),
  pricingModel: z.string().trim().min(1),
  primaryCategory: z.string().trim().min(1),
  primarySubcategory: z.string().trim(),
  secondaryCategories: z.array(z.string().trim().min(1)),
  siteArchetype: z.enum(onboardingSiteArchetypeValues),
})

export const onboardingGatewayHomepageClassificationSchema =
  createGatewayValidatedSchema(
    {
      type: "object",
      additionalProperties: false,
      properties: {
        buyerLanguage: {
          type: "array",
          items: {
            type: "string",
            minLength: 1,
          },
        },
        categories: {
          type: "array",
          minItems: 1,
          items: {
            type: "string",
            minLength: 1,
          },
        },
        pageEquivalentPatterns: {
          type: "array",
          items: {
            type: "string",
            minLength: 1,
          },
        },
        personas: {
          type: "array",
          items: {
            type: "string",
            minLength: 1,
          },
        },
        pricingModel: {
          type: "string",
          minLength: 1,
        },
        primaryCategory: {
          type: "string",
          minLength: 1,
        },
        primarySubcategory: {
          type: "string",
        },
        secondaryCategories: {
          type: "array",
          items: {
            type: "string",
            minLength: 1,
          },
        },
        siteArchetype: {
          type: "string",
          enum: [...onboardingSiteArchetypeValues],
        },
      },
      required: [
        "buyerLanguage",
        "categories",
        "pageEquivalentPatterns",
        "personas",
        "pricingModel",
        "primaryCategory",
        "primarySubcategory",
        "secondaryCategories",
        "siteArchetype",
      ],
    },
    onboardingGatewayHomepageClassificationValidationSchema
  )

const onboardingGatewayCriticalPageSelectionValidationSchema = z.object({
  pages: z.array(
    z.object({
      expectedSignals: z.array(z.string().trim().min(1)),
      pageRole: z.enum(onboardingPageRoleValues),
      priority: z.number().int().positive(),
      url: z.string().trim().min(1),
      whySelected: z.string().trim().min(1),
    })
  ).min(1),
})

export const onboardingGatewayCriticalPageSelectionSchema =
  createGatewayValidatedSchema(
    {
      type: "object",
      additionalProperties: false,
      properties: {
        pages: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              expectedSignals: {
                type: "array",
                items: {
                  type: "string",
                  minLength: 1,
                },
              },
              pageRole: {
                type: "string",
                enum: [...onboardingPageRoleValues],
              },
              priority: {
                type: "integer",
                minimum: 1,
              },
              url: {
                type: "string",
                minLength: 1,
              },
              whySelected: {
                type: "string",
                minLength: 1,
              },
            },
            required: [
              "expectedSignals",
              "pageRole",
              "priority",
              "url",
              "whySelected",
            ],
          },
        },
      },
      required: ["pages"],
    },
    onboardingGatewayCriticalPageSelectionValidationSchema
  )

const onboardingGatewayBrandProfileValidationSchema = z.object({
  careers: z.string().trim().nullable(),
  categories: z.array(z.string().trim().min(1)).min(1),
  comparisonSets: z.array(z.string().trim().min(1)),
  conversionMoments: z.array(z.string().trim().min(1)),
  detailedDescription: z.string().trim().min(1),
  differentiators: z.array(z.string().trim().min(1)),
  evidenceUrls: z.array(z.string().trim().min(1)),
  geography: z.string().trim().nullable(),
  jobsToBeDone: z.array(z.string().trim().min(1)),
  keywords: z.array(z.string().trim().min(1)),
  pricing: z.string().trim().min(1),
  primaryCategory: z.string().trim().min(1),
  primarySubcategory: z.string().trim(),
  products: z.array(z.string().trim().min(1)),
  reputationalQuestions: z.array(z.string().trim().min(1)),
  researchJourneys: z.array(z.string().trim().min(1)),
  secondaryCategories: z.array(z.string().trim().min(1)),
  siteArchetype: z.enum(onboardingSiteArchetypeValues),
  targetAudiences: z.array(z.string().trim().min(1)),
  targetCustomers: z.array(z.string().trim().min(1)),
  warnings: z.array(z.string()),
})

export const onboardingGatewayBrandProfileSchema =
  createGatewayValidatedSchema(
    {
      type: "object",
      additionalProperties: false,
      properties: {
        careers: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        categories: {
          type: "array",
          minItems: 1,
          items: {
            type: "string",
            minLength: 1,
          },
        },
        comparisonSets: {
          type: "array",
          items: {
            type: "string",
            minLength: 1,
          },
        },
        conversionMoments: {
          type: "array",
          items: {
            type: "string",
            minLength: 1,
          },
        },
        detailedDescription: {
          type: "string",
          minLength: 1,
        },
        differentiators: {
          type: "array",
          items: {
            type: "string",
            minLength: 1,
          },
        },
        evidenceUrls: {
          type: "array",
          items: {
            type: "string",
            minLength: 1,
          },
        },
        geography: {
          anyOf: [{ type: "string" }, { type: "null" }],
        },
        jobsToBeDone: {
          type: "array",
          items: {
            type: "string",
            minLength: 1,
          },
        },
        keywords: {
          type: "array",
          items: {
            type: "string",
            minLength: 1,
          },
        },
        pricing: {
          type: "string",
          minLength: 1,
        },
        primaryCategory: {
          type: "string",
          minLength: 1,
        },
        primarySubcategory: {
          type: "string",
        },
        products: {
          type: "array",
          items: {
            type: "string",
            minLength: 1,
          },
        },
        reputationalQuestions: {
          type: "array",
          items: {
            type: "string",
            minLength: 1,
          },
        },
        researchJourneys: {
          type: "array",
          items: {
            type: "string",
            minLength: 1,
          },
        },
        secondaryCategories: {
          type: "array",
          items: {
            type: "string",
            minLength: 1,
          },
        },
        siteArchetype: {
          type: "string",
          enum: [...onboardingSiteArchetypeValues],
        },
        targetAudiences: {
          type: "array",
          items: {
            type: "string",
            minLength: 1,
          },
        },
        targetCustomers: {
          type: "array",
          items: {
            type: "string",
            minLength: 1,
          },
        },
        warnings: {
          type: "array",
          items: {
            type: "string",
          },
        },
      },
      required: [
        "careers",
        "categories",
        "comparisonSets",
        "conversionMoments",
        "detailedDescription",
        "differentiators",
        "evidenceUrls",
        "geography",
        "jobsToBeDone",
        "keywords",
        "pricing",
        "primaryCategory",
        "primarySubcategory",
        "products",
        "reputationalQuestions",
        "researchJourneys",
        "secondaryCategories",
        "siteArchetype",
        "targetAudiences",
        "targetCustomers",
        "warnings",
      ],
    },
    onboardingGatewayBrandProfileValidationSchema
  )

const onboardingGatewayTopicClusterValidationSchema = z.object({
  topics: z.array(
    z.object({
      clusterId: z.string().trim().min(1),
      intentSummary: z.string().trim().min(1),
      source: onboardingTopicSourceSchema,
      sourceUrls: z.array(z.string().trim().min(1)),
      topicName: z.string().trim().min(1),
    })
  ),
})

export const onboardingGatewayTopicClusterSchema =
  createGatewayValidatedSchema(
    {
      type: "object",
      additionalProperties: false,
      properties: {
        topics: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              clusterId: {
                type: "string",
                minLength: 1,
              },
              intentSummary: {
                type: "string",
                minLength: 1,
              },
              source: {
                type: "string",
                enum: ["user_added", "ai_suggested", "system_seeded"],
              },
              sourceUrls: {
                type: "array",
                items: {
                  type: "string",
                  minLength: 1,
                },
              },
              topicName: {
                type: "string",
                minLength: 1,
              },
            },
            required: [
              "clusterId",
              "intentSummary",
              "source",
              "sourceUrls",
              "topicName",
            ],
          },
        },
      },
      required: ["topics"],
    },
    onboardingGatewayTopicClusterValidationSchema
  )

export const onboardingPromptFormulaCandidateSchema = z.object({
  category: z.string().trim().min(1),
  constraint: z.string().trim().min(1),
  context: z.string().trim().min(1),
  goal: z.string().trim().min(1),
  persona: z.string().trim().min(1),
  promptText: z.string().trim().min(1),
  variantType: z.enum(onboardingPromptVariantValues),
})

export const onboardingPromptFormulaPayloadSchema = z.object({
  topics: z.array(
    z.object({
      prompts: z.array(onboardingPromptFormulaCandidateSchema).min(1),
      topicName: z.string().trim().min(1),
    })
  ),
})

export const onboardingPromptGenerationCandidateSchema =
  onboardingPromptFormulaCandidateSchema

export const onboardingPromptGenerationSchema =
  onboardingPromptFormulaPayloadSchema

export const onboardingGatewayPromptGenerationSchema =
  onboardingPromptFormulaPayloadSchema

export const onboardingCatalogPromptSchema = z.object({
  id: z.string().trim().min(1),
  intent: onboardingPromptIntentSchema,
  text: z.string().trim().min(1),
})

export const onboardingCatalogTopicSchema = z.object({
  description: z.string().trim().min(1),
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  prompts: z.array(onboardingCatalogPromptSchema).min(1),
})

export const onboardingCatalogSchema = z.object({
  brand: z.string().trim().min(1),
  businessType: z.string().trim().min(1),
  domain: z.string().trim().min(1),
  primaryCategory: z.string().trim().min(1),
  topics: z.array(onboardingCatalogTopicSchema),
})

const onboardingGatewayCatalogValidationSchema = onboardingCatalogSchema

export const onboardingGatewayCatalogSchema = createGatewayValidatedSchema(
  {
    type: "object",
    additionalProperties: false,
    properties: {
      brand: {
        type: "string",
        minLength: 1,
      },
      businessType: {
        type: "string",
        minLength: 1,
      },
      domain: {
        type: "string",
        minLength: 1,
      },
      primaryCategory: {
        type: "string",
        minLength: 1,
      },
      topics: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            description: {
              type: "string",
              minLength: 1,
            },
            id: {
              type: "string",
              minLength: 1,
            },
            name: {
              type: "string",
              minLength: 1,
            },
            prompts: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                additionalProperties: false,
                properties: {
                  id: {
                    type: "string",
                    minLength: 1,
                  },
                  intent: {
                    type: "string",
                    enum: [...onboardingPromptIntentValues],
                  },
                  text: {
                    type: "string",
                    minLength: 1,
                  },
                },
                required: ["id", "intent", "text"],
              },
            },
          },
          required: ["description", "id", "name", "prompts"],
        },
      },
    },
    required: [
      "brand",
      "businessType",
      "domain",
      "primaryCategory",
      "topics",
    ],
  },
  onboardingGatewayCatalogValidationSchema
)

const onboardingGatewayPageSignalBatchValidationSchema =
  onboardingPageSignalBatchSchema

export const onboardingGatewayPageSignalBatchSchema =
  createGatewayValidatedSchema(
    {
      type: "object",
      additionalProperties: false,
      properties: {
        pages: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              competitorCandidates: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    name: {
                      type: "string",
                      minLength: 1,
                    },
                    website: {
                      type: "string",
                      minLength: 1,
                    },
                  },
                  required: ["name", "website"],
                },
              },
              confidence: {
                type: "number",
                minimum: 0,
                maximum: 1,
              },
              entities: {
                type: "array",
                items: {
                  type: "string",
                  minLength: 1,
                },
              },
              evidenceSnippets: {
                type: "array",
                items: {
                  type: "string",
                  minLength: 1,
                },
              },
              intents: {
                type: "array",
                items: {
                  type: "string",
                  minLength: 1,
                },
              },
              pageType: {
                type: "string",
                enum: [...onboardingPageRoleValues],
              },
              url: {
                type: "string",
                minLength: 1,
              },
            },
            required: [
              "competitorCandidates",
              "confidence",
              "entities",
              "evidenceSnippets",
              "intents",
              "pageType",
              "url",
            ],
          },
        },
      },
      required: ["pages"],
    },
    onboardingGatewayPageSignalBatchValidationSchema
  )

export const onboardingPromptScoreBreakdownSchema = z.object({
  brandCompetitorRelevance: z.number().min(0).max(10),
  buyerValue: z.number().min(0).max(15),
  evidenceGrounding: z.number().min(0).max(10),
  naturalUserPhrasing: z.number().min(0).max(20),
  specificity: z.number().min(0).max(15),
  topicFit: z.number().min(0).max(30),
})

export const onboardingPromptScoreSchema = z.object({
  scoredPrompts: z.array(
    z.object({
      breakdown: onboardingPromptScoreBreakdownSchema,
      evidenceUrls: z.array(z.string().trim().min(1)),
      keep: z.boolean(),
      pqsScore: z.number().min(0).max(100),
      reason: z.string(),
      renderedPromptText: z.string(),
      replacementPromptText: z.string().optional(),
      variantType: z.enum(onboardingPromptVariantValues),
    })
  ),
})

export const onboardingGatewayPromptScoreSchema = z.object({
  scoredPrompts: z.array(
    z.object({
      breakdown: onboardingPromptScoreBreakdownSchema,
      evidenceUrls: z.array(z.string().trim().min(1)),
      keep: z.boolean(),
      pqsScore: z.number().min(0).max(100),
      reason: z.string().trim().min(1),
      renderedPromptText: z.string().trim().min(1),
      replacementPromptText: z.string().trim().nullable(),
      variantType: z.enum(onboardingPromptVariantValues),
    })
  ),
})

export const onboardingCompetitorScoringPayloadSchema = z.object({
  competitors: z.array(
    onboardingCompetitorSchema.extend({
      buyerOverlap: z.number().min(0).max(1),
      categoryOverlap: z.number().min(0).max(1),
      geoSimilarity: z.number().min(0).max(1),
      keywordOverlap: z.number().min(0).max(1),
      pricingSimilarity: z.number().min(0).max(1),
      totalScore: z.number().min(0).max(1),
      whySelected: z.string().trim().min(1),
    })
  ),
})

export const onboardingAnalysisResultSchema = z.object({
  brandProfile: onboardingBrandProfileSchema,
  catalog: onboardingCatalogSchema,
  competitors: z.array(onboardingCompetitorSchema),
  description: z.string(),
  topics: z.array(onboardingTopicDraftSchema),
  warnings: z.array(z.string()),
})

export const onboardingAnalysisStartResponseSchema = z.object({
  analysisId: z.string().trim().min(1),
  status: z.enum(onboardingWorkflowPhaseValues),
  warnings: z.array(z.string()),
})

export const onboardingAnalysisStatusResponseSchema =
  onboardingAnalysisStartResponseSchema.extend({
    result: onboardingAnalysisResultSchema.optional(),
  })

export const onboardingTopicPromptRequestSchema = z.object({
  analysisRunId: z.string().trim().min(1, "Analysis run ID is required"),
  brandProfile: onboardingBrandProfileSchema.optional(),
  companyName: z.string().trim().min(1, "Company name is required"),
  competitors: z.array(onboardingCompetitorSchema),
  description: z.string(),
  excludedPromptTexts: z.array(z.string().trim().min(1)).default([]).optional(),
  excludedTopicNames: z.array(z.string().trim().min(1)).default([]).optional(),
  mode: z.enum(["full_refresh"]).default("full_refresh").optional(),
  topics: z.array(onboardingTopicInputSchema).default([]).optional(),
  website: z.string().trim().min(1, "Website is required"),
})

export const onboardingTopicPromptResponseSchema = z.object({
  catalog: onboardingCatalogSchema,
  topics: z.array(onboardingTopicDraftSchema),
  warnings: z.array(z.string()),
})

export const completeOnboardingRequestSchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required"),
  competitors: z
    .array(onboardingCompetitorSchema)
    .min(3, "Add at least 3 competitors."),
  description: z
    .string()
    .trim()
    .min(1, "Tell us about your business"),
  projectId: z.string().trim().min(1, "Project ID is required"),
  topics: z.array(onboardingTopicDraftSchema).min(3, "Add at least 3 topics."),
  website: z.string().trim().min(1, "Website is required"),
})

export type OnboardingBrandRequest = z.infer<
  typeof onboardingBrandRequestSchema
>

export type OnboardingCompetitor = z.infer<typeof onboardingCompetitorSchema>

export type OnboardingBrandResponse = z.infer<
  typeof onboardingBrandResponseSchema
>

export type OnboardingAiSuggestion = z.infer<
  typeof onboardingAiSuggestionSchema
>

export type OnboardingScrapeContext = z.infer<
  typeof onboardingScrapeContextSchema
>

export type OnboardingCompetitorRecovery = z.infer<
  typeof onboardingCompetitorRecoverySchema
>

export type OnboardingPromptDraft = z.infer<
  typeof onboardingPromptDraftSchema
> & {
  addedVia: TrackedPromptAddedVia
  scoreStatus?: TrackedPromptScoreStatus
  variantType?: TrackedPromptVariantType
}

export type OnboardingTopicInput = z.infer<typeof onboardingTopicInputSchema> & {
  source: TopicSource
}

export type OnboardingTopicDraft = z.infer<typeof onboardingTopicDraftSchema> & {
  prompts: OnboardingPromptDraft[]
  source: TopicSource
}

export type OnboardingAnalysisRequest = z.infer<
  typeof onboardingAnalysisRequestSchema
>

export type OnboardingHomepageClassification = z.infer<
  typeof onboardingHomepageClassificationSchema
>

export type OnboardingCriticalPageSelection = z.infer<
  typeof onboardingCriticalPageSelectionSchema
>

export type OnboardingPageSignal = z.infer<typeof onboardingPageSignalSchema>

export type OnboardingPageSignalBatch = z.infer<
  typeof onboardingPageSignalBatchSchema
>

export type OnboardingBrandProfile = z.infer<
  typeof onboardingBrandProfileSchema
>

export type OnboardingPromptGenerationCandidate = z.infer<
  typeof onboardingPromptGenerationCandidateSchema
>

export type OnboardingPromptGeneration = z.infer<
  typeof onboardingPromptGenerationSchema
>

export type OnboardingCatalog = z.infer<typeof onboardingCatalogSchema>

export type OnboardingCompetitorScoringPayload = z.infer<
  typeof onboardingCompetitorScoringPayloadSchema
>

export type OnboardingAnalysisResult = z.infer<
  typeof onboardingAnalysisResultSchema
>

export type OnboardingAnalysisStartResponse = z.infer<
  typeof onboardingAnalysisStartResponseSchema
>

export type OnboardingAnalysisStatusResponse = z.infer<
  typeof onboardingAnalysisStatusResponseSchema
>

export type OnboardingTopicPromptRequest = z.infer<
  typeof onboardingTopicPromptRequestSchema
>

export type OnboardingTopicPromptResponse = z.infer<
  typeof onboardingTopicPromptResponseSchema
>

export type CompleteOnboardingRequest = z.infer<
  typeof completeOnboardingRequestSchema
>
