import { z } from "zod"

const onboardingConfigSchema = z.object({
  FIRECRAWL_API_KEY: z.string().trim().min(1, "FIRECRAWL_API_KEY is required"),
})

export type OnboardingConfig = z.infer<typeof onboardingConfigSchema>

let cachedConfig: OnboardingConfig | null = null

export function resolveOnboardingConfig(
  env?: Record<string, string | undefined>
): OnboardingConfig {
  const source = env ?? {
    FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY,
  }

  const parsed = onboardingConfigSchema.safeParse(source)

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(". ")
    )
  }

  return parsed.data
}

export function getOnboardingConfig() {
  if (!cachedConfig) {
    cachedConfig = resolveOnboardingConfig()
  }

  return cachedConfig
}
