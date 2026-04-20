import { generateText, NoOutputGeneratedError, Output, stepCountIs } from "ai"

import { buildGatewayStructuredOutputSystemPrompt } from "@/lib/ai/gateway-structured-output"
import {
  getLanguageModel,
  getOpenAiWebSearchTool,
} from "@/lib/ai/provider-config"
import { generateCompetitorCandidates } from "@/lib/onboarding/competitor-candidates"
import { scrapeBrandHomepageArtifact } from "@/lib/onboarding/firecrawl"
import {
  buildEnhanceBrandProfilePrompt,
  buildEnhancementFallbackWarning,
  enhanceBrandProfileFieldGuidanceText,
  enhanceBrandProfileOutputRulesText,
  enhanceBrandProfileSystemPrompt,
} from "@/lib/onboarding/prompts/enhance-brand-profile"
import {
  buildSeedBrandProfilePrompt,
  seedBrandProfileFieldGuidanceText,
  seedBrandProfileOutputRulesText,
  seedBrandProfileSystemPrompt,
} from "@/lib/onboarding/prompts/seed-brand-profile"
import {
  onboardingBrandProfileSchema,
  onboardingBrandResponseSchema,
  onboardingEnhancedBrandProfileSchema,
  onboardingGatewayEnhancedBrandProfileSchema,
  onboardingGatewaySeedBrandProfileSchema,
  onboardingSeedBrandProfileSchema,
  type OnboardingBrandProfile,
  type OnboardingBrandResponse,
  type OnboardingCompetitor,
  type OnboardingEnhancedBrandProfile,
  type OnboardingHomepageScrapeArtifact,
  type OnboardingSeedBrandProfile,
} from "@/lib/onboarding/types"
import { generateTopicPromptCollection } from "@/lib/onboarding/topic-prompt-generator"

const WEB_RESEARCH_MAX_STEPS = 8
const SEARCH_ASSISTED_MODEL_ID = "openai/gpt-5.4-mini"

function uniqueStrings(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim() ?? "").filter(Boolean))]
}

function takeFirstNonEmpty(...values: Array<string | null | undefined>) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)
}

function inferSiteArchetype(input: {
  businessType: string
  categories: string[]
  productsOrServices: string[]
}) {
  const haystack = [
    input.businessType,
    ...input.categories,
    ...input.productsOrServices,
  ]
    .join(" ")
    .toLowerCase()

  if (/\bmarketplace\b/.test(haystack)) {
    return "marketplace" as const
  }

  if (
    /\b(ecommerce|e-commerce|retail|shop|store|apparel|footwear|consumer goods|dtc)\b/.test(
      haystack
    )
  ) {
    return "ecommerce" as const
  }

  if (/\b(media|publication|publisher|news|content platform)\b/.test(haystack)) {
    return "media" as const
  }

  if (
    /\b(developer tool|api|sdk|cli|devtool|infrastructure|platform engineering)\b/.test(
      haystack
    )
  ) {
    return "developer_tool" as const
  }

  if (
    /\b(service|services|agency|consulting|consultancy|local business|professional services)\b/.test(
      haystack
    )
  ) {
    return "services" as const
  }

  if (input.productsOrServices.length >= 3) {
    return "multi_product" as const
  }

  return "saas" as const
}

function summarizePricing(seedBrandProfile: OnboardingSeedBrandProfile) {
  const explicitSignals = uniqueStrings(
    seedBrandProfile.pricingSignals.map((signal) => signal.signal)
  )

  return explicitSignals.join("; ") || "pricing not stated"
}

function collectReputationQuestions(
  enhancedBrandProfile: OnboardingEnhancedBrandProfile | null
) {
  if (!enhancedBrandProfile) {
    return []
  }

  return uniqueStrings([
    ...enhancedBrandProfile.reputationContext.likelyReputationQuestions,
    ...enhancedBrandProfile.reputationContext.trustQuestions,
    ...enhancedBrandProfile.reputationContext.riskQuestions,
    ...enhancedBrandProfile.reputationContext.qualityQuestions,
    ...enhancedBrandProfile.reputationContext.valueQuestions,
  ]).slice(0, 12)
}

function createEnhanceBrandProfileSharedInput(input: {
  homepageArtifact: OnboardingHomepageScrapeArtifact
  seedBrandProfile: OnboardingSeedBrandProfile
}) {
  return {
    prompt: buildEnhanceBrandProfilePrompt({
      homepageArtifact: input.homepageArtifact,
      seedBrandProfile: input.seedBrandProfile,
    }),
    system: buildGatewayStructuredOutputSystemPrompt([
      enhanceBrandProfileSystemPrompt,
      enhanceBrandProfileFieldGuidanceText,
      enhanceBrandProfileOutputRulesText,
    ]),
    tools: {
      web_search: getOpenAiWebSearchTool(),
    },
  }
}

async function enhanceBrandProfileWithSearch(input: {
  homepageArtifact: OnboardingHomepageScrapeArtifact
  seedBrandProfile: OnboardingSeedBrandProfile
}) {
  const sharedInput = createEnhanceBrandProfileSharedInput(input)
  const { output } = await generateText({
    model: getLanguageModel("openai", {
      capability: "webSearch",
      modelId: SEARCH_ASSISTED_MODEL_ID,
    }),
    output: Output.object({
      description:
        "Enhanced homepage-derived brand profile with external category context, GEO prompt strategy guidance, reputation questions, buying journey, source notes, and uncertainties.",
      name: "onboarding_enhanced_brand_profile",
      schema: onboardingGatewayEnhancedBrandProfileSchema,
    }),
    prompt: sharedInput.prompt,
    system: sharedInput.system,
    temperature: 0,
    tools: sharedInput.tools,
    stopWhen: stepCountIs(WEB_RESEARCH_MAX_STEPS),
    onStepFinish({ finishReason, stepNumber, text, toolCalls, toolResults, usage }) {
      console.log("[onboarding] Search-assisted enhancement step finished", {
        finishReason,
        stepNumber,
        textLength: text.length,
        toolCallCount: toolCalls.length,
        toolResultCount: toolResults.length,
        usage,
      })
    },
  })

  return onboardingEnhancedBrandProfileSchema.parse(output)
}

async function enhanceBrandProfileWithStructuredFallback(input: {
  homepageArtifact: OnboardingHomepageScrapeArtifact
  seedBrandProfile: OnboardingSeedBrandProfile
}) {
  const { output } = await generateText({
    model: getLanguageModel("openai", {
      capability: "structuredOutput",
      modelId: SEARCH_ASSISTED_MODEL_ID,
    }),
    output: Output.object({
      description:
        "Enhanced homepage-derived brand profile with external category context, GEO prompt strategy guidance, reputation questions, buying journey, source notes, and uncertainties.",
      name: "onboarding_enhanced_brand_profile",
      schema: onboardingGatewayEnhancedBrandProfileSchema,
    }),
    prompt: buildEnhanceBrandProfilePrompt({
      homepageArtifact: input.homepageArtifact,
      seedBrandProfile: input.seedBrandProfile,
    }),
    system: buildGatewayStructuredOutputSystemPrompt([
      enhanceBrandProfileSystemPrompt,
      enhanceBrandProfileFieldGuidanceText,
      enhanceBrandProfileOutputRulesText,
      "Fallback mode: do not call tools. If external evidence is unavailable, preserve uncertainty and use empty arrays instead of guessing.",
    ]),
    temperature: 0,
  })

  return onboardingEnhancedBrandProfileSchema.parse(output)
}

export async function scrapeHomepageArtifact(
  website: string
): Promise<OnboardingHomepageScrapeArtifact> {
  return scrapeBrandHomepageArtifact(website)
}

export async function buildSeedBrandProfile(input: {
  companyName: string
  homepageArtifact: OnboardingHomepageScrapeArtifact
  website: string
}): Promise<OnboardingSeedBrandProfile> {
  console.log("[onboarding] Building seed brand profile", {
    companyName: input.companyName,
    homepageUrl: input.homepageArtifact.homepageUrl,
    website: input.website,
  })

  const { output } = await generateText({
    model: getLanguageModel("openai", {
      capability: "structuredOutput",
      modelId: "openai/gpt-5.4-mini",
    }),
    output: Output.object({
      description:
        "Homepage-only brand profile seed with first-party evidence, signals, missing context, and confidence.",
      name: "onboarding_seed_brand_profile",
      schema: onboardingGatewaySeedBrandProfileSchema,
    }),
    prompt: buildSeedBrandProfilePrompt({
      homepageArtifact: input.homepageArtifact,
    }),
    system: buildGatewayStructuredOutputSystemPrompt([
      seedBrandProfileSystemPrompt,
      seedBrandProfileFieldGuidanceText,
      seedBrandProfileOutputRulesText,
    ]),
    temperature: 0,
  })

  const seedBrandProfile = onboardingSeedBrandProfileSchema.parse(output)

  console.log("[onboarding] Built seed brand profile", {
    brandName: seedBrandProfile.brandName,
    category: seedBrandProfile.primaryCategory,
    productCount: seedBrandProfile.productsOrServices.length,
  })

  return seedBrandProfile
}

export async function enhanceBrandProfile(input: {
  companyName: string
  homepageArtifact: OnboardingHomepageScrapeArtifact
  seedBrandProfile: OnboardingSeedBrandProfile
  website: string
}): Promise<OnboardingEnhancedBrandProfile> {
  console.log("[onboarding] Enhancing brand profile", {
    companyName: input.companyName,
    homepageUrl: input.homepageArtifact.homepageUrl,
    seedCategory: input.seedBrandProfile.primaryCategory,
  })

  let enhancedBrandProfile: OnboardingEnhancedBrandProfile

  try {
    enhancedBrandProfile = await enhanceBrandProfileWithSearch({
      homepageArtifact: input.homepageArtifact,
      seedBrandProfile: input.seedBrandProfile,
    })
  } catch (error) {
    if (NoOutputGeneratedError.isInstance(error)) {
      console.warn("[onboarding] Search-assisted enhancement produced no final output", {
        cause:
          error.cause instanceof Error ? error.cause.message : error.cause ?? null,
        homepageUrl: input.homepageArtifact.homepageUrl,
      })
    }

    console.warn("[onboarding] Search-assisted enhancement failed, using fallback", {
      error: error instanceof Error ? error.message : error,
      homepageUrl: input.homepageArtifact.homepageUrl,
    })

    enhancedBrandProfile = await enhanceBrandProfileWithStructuredFallback({
      homepageArtifact: input.homepageArtifact,
      seedBrandProfile: input.seedBrandProfile,
    })
  }

  console.log("[onboarding] Enhanced brand profile", {
    category: enhancedBrandProfile.brand.primaryCategory,
    uncertaintyCount: enhancedBrandProfile.uncertainties.length,
  })

  return enhancedBrandProfile
}

export function toOnboardingBrandProfile(input: {
  enhancedBrandProfile: OnboardingEnhancedBrandProfile | null
  homepageArtifact: OnboardingHomepageScrapeArtifact
  seedBrandProfile: OnboardingSeedBrandProfile
  warnings: string[]
}): OnboardingBrandProfile {
  const firstPartySummary = input.enhancedBrandProfile?.firstPartySummary
  const externalCategoryContext = input.enhancedBrandProfile?.externalCategoryContext
  const primaryCategory =
    takeFirstNonEmpty(
      input.enhancedBrandProfile?.brand.primaryCategory,
      input.seedBrandProfile.primaryCategory
    ) ?? "unknown"
  const secondaryCategories = uniqueStrings([
    ...input.seedBrandProfile.secondaryCategories,
    ...(externalCategoryContext?.categoryNames ?? []),
    ...(externalCategoryContext?.adjacentCategories ?? []),
  ]).filter((category) => category !== primaryCategory)
  const productsOrServices = uniqueStrings([
    ...(firstPartySummary?.productsOrServices ?? []),
    ...input.seedBrandProfile.productsOrServices.map((item) => item.name),
  ])
  const targetAudiences = uniqueStrings([
    ...(firstPartySummary?.targetAudiences ?? []),
    ...input.seedBrandProfile.targetAudiences.map((item) => item.audience),
  ])

  return onboardingBrandProfileSchema.parse({
    careers: null,
    categories: uniqueStrings([primaryCategory, ...secondaryCategories]),
    comparisonSets: uniqueStrings(
      externalCategoryContext?.commonComparisonPatterns ?? []
    ),
    conversionMoments: uniqueStrings([
      ...(firstPartySummary?.conversionActions ?? []),
      ...(input.enhancedBrandProfile?.buyingJourney.transactionalQueries ?? []),
      ...input.seedBrandProfile.conversionActions.map((item) => item.action),
    ]),
    detailedDescription:
      takeFirstNonEmpty(
        firstPartySummary?.oneSentenceDescription,
        input.seedBrandProfile.oneSentenceDescription
      ) ?? input.seedBrandProfile.brandName,
    differentiators: uniqueStrings([
      ...(firstPartySummary?.differentiators ?? []),
      ...input.seedBrandProfile.differentiators.map((item) => item.claim),
    ]),
    evidenceUrls: [input.homepageArtifact.homepageUrl],
    geography: null,
    jobsToBeDone: uniqueStrings([
      ...(firstPartySummary?.useCases ?? []),
      ...(input.enhancedBrandProfile?.buyingJourney.problemAwareQueries ?? []),
      ...input.seedBrandProfile.useCases.map((item) => item.useCase),
    ]).slice(0, 8),
    keywords: uniqueStrings([
      ...input.seedBrandProfile.siteVocabulary.categoryTerms,
      ...input.seedBrandProfile.siteVocabulary.productTerms,
      ...input.seedBrandProfile.siteVocabulary.useCaseTerms,
      ...(externalCategoryContext?.categoryLanguage ?? []),
    ]).slice(0, 12),
    pricing: summarizePricing(input.seedBrandProfile),
    primaryCategory,
    primarySubcategory: secondaryCategories[0] ?? "",
    products: productsOrServices,
    reputationalQuestions: collectReputationQuestions(input.enhancedBrandProfile),
    researchJourneys: uniqueStrings([
      ...(input.enhancedBrandProfile?.buyingJourney.solutionAwareQueries ?? []),
      ...(input.enhancedBrandProfile?.buyingJourney.comparisonQueries ?? []),
      ...(input.enhancedBrandProfile?.buyingJourney.followUpQueries ?? []),
    ]).slice(0, 10),
    secondaryCategories,
    siteArchetype: inferSiteArchetype({
      businessType:
        takeFirstNonEmpty(
          input.enhancedBrandProfile?.brand.businessType,
          input.seedBrandProfile.businessType
        ) ?? "unknown",
      categories: uniqueStrings([primaryCategory, ...secondaryCategories]),
      productsOrServices,
    }),
    targetAudiences,
    targetCustomers: targetAudiences,
    warnings: uniqueStrings(input.warnings),
  })
}

export function getEnhancementFallbackWarning() {
  return buildEnhancementFallbackWarning()
}

export async function generateCompatibilityOnboardingSuggestions(input: {
  companyName: string
  website: string
}): Promise<OnboardingBrandResponse> {
  console.log("[onboarding] Starting compatibility homepage analysis", {
    companyName: input.companyName,
    website: input.website,
  })

  const warnings: string[] = []
  let homepageArtifact: OnboardingHomepageScrapeArtifact

  try {
    homepageArtifact = await scrapeHomepageArtifact(input.website)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "We could not inspect your homepage, so the next steps will remain manual."

    return onboardingBrandResponseSchema.parse({
      competitors: [],
      description: "",
      topics: [],
      warnings: [message],
    })
  }

  let seedBrandProfile: OnboardingSeedBrandProfile

  try {
    seedBrandProfile = await buildSeedBrandProfile({
      companyName: input.companyName,
      homepageArtifact,
      website: input.website,
    })
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? error.message
        : "We could not build a homepage brand seed."
    )

    return onboardingBrandResponseSchema.parse({
      competitors: [],
      description: "",
      topics: [],
      warnings,
    })
  }

  let enhancedBrandProfile: OnboardingEnhancedBrandProfile | null = null

  try {
    enhancedBrandProfile = await enhanceBrandProfile({
      companyName: input.companyName,
      homepageArtifact,
      seedBrandProfile,
      website: input.website,
    })
  } catch (error) {
    void error
    warnings.push(getEnhancementFallbackWarning())
  }

  const brandProfile = toOnboardingBrandProfile({
    enhancedBrandProfile,
    homepageArtifact,
    seedBrandProfile,
    warnings,
  })

  let competitors: OnboardingCompetitor[] = []

  try {
    console.log("[onboarding] Generating compatibility competitors", {
      companyName: input.companyName,
      website: input.website,
    })
    competitors = await generateCompetitorCandidates({
      brandProfile,
      companyName: input.companyName,
      website: input.website,
    })
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `We could not load competitors automatically. ${error.message}`
        : "We could not load competitors automatically."
    )
  }

  let topicWarnings: string[] = []
  let topics: string[] = []

  try {
    console.log("[onboarding] Generating compatibility topics", {
      companyName: input.companyName,
      website: input.website,
    })
    const topicCollection = await generateTopicPromptCollection({
      analysisRunId: "compatibility-route",
      brandProfile,
      companyName: input.companyName,
      competitors,
      description: brandProfile.detailedDescription,
      generationConfig: {
        promptsPerTopic: 1,
        topicCountRange: {
          max: 5,
          min: 4,
        },
      },
      website: input.website,
    })

    topicWarnings = topicCollection.warnings
    topics = topicCollection.catalog.topics.map((topic) => topic.name)
  } catch (error) {
    warnings.push(
      error instanceof Error
        ? `We could not generate topics automatically. ${error.message}`
        : "We could not generate topics automatically."
    )
  }

  const response = onboardingBrandResponseSchema.parse({
    competitors,
    description: brandProfile.detailedDescription,
    topics: uniqueStrings(topics).slice(0, 10),
    warnings: uniqueStrings([...warnings, ...topicWarnings]),
  })

  console.log("[onboarding] Completed compatibility homepage analysis", {
    competitorCount: response.competitors.length,
    topicCount: response.topics.length,
    warningCount: response.warnings.length,
  })

  return response
}
