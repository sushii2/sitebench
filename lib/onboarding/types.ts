import { z } from "zod"

import type { TopicSource } from "@/lib/project-topics/types"
import type {
  TrackedPromptAddedVia,
  TrackedPromptScoreStatus,
  TrackedPromptVariantType,
} from "@/lib/tracked-prompts/types"

const onboardingPromptVariantValues = [
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

const onboardingPromptIntentTypeValues = [
  "category_discovery",
  "recommendation",
  "comparison",
  "alternatives",
  "problem_solving",
  "best_practices",
  "pricing",
  "implementation",
] as const

const onboardingPromptPurchaseStageValues = [
  "discovery",
  "consideration",
  "decision",
] as const

const onboardingPromptBrandRelevanceValues = [
  "direct",
  "indirect",
  "adjacent",
] as const

const onboardingPromptCommercialValueValues = [
  "high",
  "medium",
  "low",
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
  competitors: z.array(
    z.object({
      name: z.string(),
      website: z.string(),
    })
  ),
})

export const onboardingCompetitorRecoverySchema = z.object({
  competitors: z.array(
    z.object({
      name: z.string(),
      website: z.string(),
    })
  ),
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

export const onboardingPromptDraftSchema = z.object({
  addedVia: onboardingPromptAddedViaSchema,
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
  topicId: z.string().trim().min(1).optional(),
})

export const onboardingAnalysisRequestSchema = z.object({
  projectId: z.string().trim().min(1, "Project ID is required"),
  companyName: z.string().trim().min(1, "Company name is required"),
  website: z.string().trim().min(1, "Website is required"),
})

export const onboardingPageSignalSchema = z.object({
  competitorCandidates: z.array(onboardingCompetitorSchema),
  confidence: z.number().min(0).max(1),
  entities: z.array(z.string()),
  evidenceSnippets: z.array(z.string()),
  intents: z.array(z.string()),
  pageType: z.enum([
    "homepage",
    "product",
    "pricing",
    "comparison",
    "blog",
    "excluded",
  ]),
  summary: z.string(),
  url: z.string().trim().min(1),
})

export const onboardingBrandProfileSchema = z.object({
  adjacentCategories: z.array(z.string().trim().min(1)),
  category: z.string().trim().min(1),
  competitors: z.array(onboardingCompetitorSchema),
  description: z.string(),
  differentiators: z.array(z.string().trim().min(1)),
  evidenceUrls: z.array(z.string().trim().min(1)),
  productCategories: z.array(z.string().trim().min(1)),
  targetAudiences: z.array(z.string().trim().min(1)),
  topUseCases: z.array(z.string().trim().min(1)),
  warnings: z.array(z.string()),
})

export const onboardingTopicClusterSchema = z.object({
  topics: z.array(
    onboardingTopicDraftSchema.omit({
      prompts: true,
      topicId: true,
    })
  ),
})

export const onboardingGatewayTopicClusterSchema = z.object({
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

export const onboardingPromptGenerationCandidateSchema = z.object({
  brandRelevance: z.enum(onboardingPromptBrandRelevanceValues),
  commercialValue: z.enum(onboardingPromptCommercialValueValues),
  intentType: z.enum(onboardingPromptIntentTypeValues),
  likelyCompetitors: z.array(z.string().trim().min(1)),
  persona: z.string().trim().min(1),
  promptText: z.string().trim().min(1),
  purchaseStage: z.enum(onboardingPromptPurchaseStageValues),
  rationale: z.string().trim().min(1),
  segment: z.string().trim().min(1),
  templateText: z.string().trim().min(1),
  variantType: z.enum(onboardingPromptVariantValues),
})

export const onboardingPromptGenerationSchema = z.object({
  topics: z.array(
    z.object({
      prompts: z.array(onboardingPromptGenerationCandidateSchema),
      topicName: z.string().trim().min(1),
    })
  ),
})

export const onboardingGatewayPromptGenerationSchema =
  onboardingPromptGenerationSchema

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

export const onboardingAnalysisResultSchema = z.object({
  competitors: z.array(onboardingCompetitorSchema),
  description: z.string(),
  topics: z.array(onboardingTopicDraftSchema),
  warnings: z.array(z.string()),
})

export const onboardingAnalysisStartResponseSchema = z.object({
  analysisId: z.string().trim().min(1),
  status: z.enum([
    "mapping",
    "crawling",
    "extracting",
    "clustering",
    "prompting",
    "scoring",
    "completed",
    "failed",
  ]),
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
  topics: z.array(onboardingTopicInputSchema).min(1, "Add at least one topic."),
  website: z.string().trim().min(1, "Website is required"),
})

export const onboardingTopicPromptResponseSchema = z.object({
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

export type OnboardingPageSignal = z.infer<typeof onboardingPageSignalSchema>

export type OnboardingBrandProfile = z.infer<
  typeof onboardingBrandProfileSchema
>

export type OnboardingPromptGenerationCandidate = z.infer<
  typeof onboardingPromptGenerationCandidateSchema
>

export type OnboardingPromptGeneration = z.infer<
  typeof onboardingPromptGenerationSchema
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
