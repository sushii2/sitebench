import { z } from "zod"

import type { TopicSource } from "@/lib/project-topics/types"
import type { TrackedPromptAddedVia } from "@/lib/tracked-prompts/types"

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
  promptText: z.string().trim().min(1, "Prompt text is required"),
})

export const onboardingTopicInputSchema = z.object({
  source: onboardingTopicSourceSchema,
  topicName: z.string().trim().min(1, "Topic name is required"),
})

export const onboardingTopicDraftSchema = onboardingTopicInputSchema.extend({
  prompts: z.array(onboardingPromptDraftSchema),
  topicId: z.string().trim().min(1).optional(),
})

export const onboardingTopicPromptRequestSchema = z.object({
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
> & { addedVia: TrackedPromptAddedVia }

export type OnboardingTopicInput = z.infer<typeof onboardingTopicInputSchema> & {
  source: TopicSource
}

export type OnboardingTopicDraft = z.infer<typeof onboardingTopicDraftSchema> & {
  prompts: OnboardingPromptDraft[]
  source: TopicSource
}

export type OnboardingTopicPromptRequest = z.infer<
  typeof onboardingTopicPromptRequestSchema
>

export type OnboardingTopicPromptResponse = z.infer<
  typeof onboardingTopicPromptResponseSchema
>

export type CompleteOnboardingRequest = z.infer<
  typeof completeOnboardingRequestSchema
>
