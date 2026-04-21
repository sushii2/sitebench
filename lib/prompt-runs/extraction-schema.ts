import { z } from "zod"

const recommendationStatusSchema = z.enum([
  "recommended",
  "mentioned",
  "not_recommended",
])
const sentimentLabelSchema = z.enum([
  "positive",
  "neutral",
  "negative",
  "mixed",
])
const providerIdSchema = z.enum(["chatgpt", "claude", "perplexity"])

export const promptRunAnalysisBrandMetricSchema = z.object({
  brandEntityId: z.string().uuid(),
  brandName: z.string().trim().min(1),
  citationScore: z.number().min(0).max(100),
  citationUrls: z.array(z.string().url()).default([]),
  mentionCount: z.number().int().min(0),
  rankPosition: z.number().int().positive().nullable(),
  recommendationStatus: recommendationStatusSchema,
  sentimentLabel: sentimentLabelSchema,
  sentimentScore: z.number().min(-1).max(1).nullable(),
  visibilityScore: z.number().min(0).max(100),
})

export const promptRunDiscoveredCompetitorSchema = z.object({
  description: z.string().default(""),
  evidenceQuote: z.string().trim().min(1),
  name: z.string().trim().min(1),
  websiteUrl: z.string().url(),
})

export const promptRunAnalysisResponseSchema = z.object({
  brandMetrics: z.array(promptRunAnalysisBrandMetricSchema).default([]),
  providerId: providerIdSchema,
  responseSummary: z.string().default(""),
  trackedPromptId: z.string().uuid(),
})

export const promptRunAnalysisOutputSchema = z.object({
  discoveredCompetitors: z
    .array(promptRunDiscoveredCompetitorSchema)
    .default([]),
  responses: z.array(promptRunAnalysisResponseSchema).default([]),
})

export type PromptRunAnalysisOutput = z.infer<
  typeof promptRunAnalysisOutputSchema
>
export type PromptRunAnalysisResponse = z.infer<
  typeof promptRunAnalysisResponseSchema
>
