import { z } from "zod"

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
