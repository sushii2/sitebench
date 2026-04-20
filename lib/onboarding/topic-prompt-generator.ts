import { generateText } from "ai"

import {
  buildGatewayStructuredOutputSystemPrompt,
  createGatewayStructuredObjectOutput,
} from "@/lib/ai/gateway-structured-output"
import { normalizeBrandTopics, normalizeWebsite } from "@/lib/brands"
import { getLanguageModel } from "@/lib/ai/provider-config"
import type {
  OnboardingBrandProfile,
  OnboardingCatalog,
  OnboardingCompetitor,
  OnboardingEnhancedBrandProfile,
  OnboardingPromptDraft,
  OnboardingTopicDraft,
  OnboardingTopicInput,
  OnboardingTopicPromptRequest,
  OnboardingTopicPromptResponse,
} from "@/lib/onboarding/types"
import {
  onboardingBrandProfileSchema,
  onboardingCatalogSchema,
  onboardingGatewayCatalogSchema,
} from "@/lib/onboarding/types"

const DEFAULT_TOPIC_COUNT_RANGE = {
  max: 8,
  min: 6,
}

const DEFAULT_PROMPTS_PER_TOPIC = 20
const DEFAULT_STRUCTURED_OUTPUT_MODEL_ID = "openai/gpt-5.4"

type NormalizedScrapedPage = {
  competitorCandidates: OnboardingCompetitor[]
  contentSnapshot: string
  entities: string[]
  evidenceSnippets: string[]
  intents: string[]
  pageType: string
  title: string | null
  url: string
}

type CatalogGenerationConfig = {
  promptsPerTopic?: number
  topicCountRange?: {
    max: number
    min: number
  }
}

type TopicPromptGenerationInput = Pick<
  OnboardingTopicPromptRequest,
  | "analysisRunId"
  | "brandProfile"
  | "companyName"
  | "competitors"
  | "description"
  | "excludedPromptTexts"
  | "excludedTopicNames"
  | "topics"
  | "website"
> & {
  generationConfig?: CatalogGenerationConfig
  geoPromptStrategy?: OnboardingEnhancedBrandProfile["geoPromptStrategy"]
  scrapedPages?: NormalizedScrapedPage[]
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean))]
}

function normalizeTopicName(value: string) {
  return normalizeBrandTopics([value])[0] ?? normalizeWhitespace(value)
}

function normalizePromptText(value: string) {
  return normalizeWhitespace(value).toLowerCase()
}

function normalizeDomain(website: string) {
  const normalizedWebsite = normalizeWebsite(website)

  return new URL(normalizedWebsite).hostname.replace(/^www\./i, "")
}

function normalizePageUrl(value: string) {
  const url = new URL(value)
  url.hash = ""

  return url.toString()
}

function inferTargetCustomer(description: string) {
  const match = description.match(
    /\b(enterprise security teams?|security teams?|marketing teams?|brand teams?|engineering teams?|developer teams?|ecommerce teams?|retail shoppers?|buyers?)\b/i
  )

  return normalizeWhitespace(match?.[0] ?? "buyers")
}

function buildFallbackBrandProfile(
  input: Pick<
    TopicPromptGenerationInput,
    "companyName" | "description" | "topics" | "website"
  >
): OnboardingBrandProfile {
  const normalizedWebsite = normalizeWebsite(input.website)
  const topicNames = normalizeBrandTopics(
    (input.topics ?? []).map((topic) => topic.topicName)
  )
  const primaryCategory = topicNames[0] ?? "software"
  const siteArchetype =
    /\b(shop|store|collection|collections|sale|fit|size)\b/i.test(
      `${input.description} ${input.website}`
    )
      ? "ecommerce"
      : "saas"

  return onboardingBrandProfileSchema.parse({
    careers: null,
    categories: topicNames.length > 0 ? topicNames : [primaryCategory],
    comparisonSets: [],
    conversionMoments: [],
    detailedDescription: normalizeWhitespace(input.description),
    differentiators: [],
    evidenceUrls: [],
    geography: normalizedWebsite,
    jobsToBeDone:
      topicNames.length > 0 ? topicNames.slice(0, 5) : ["evaluate solutions"],
    keywords: topicNames.slice(0, 5),
    pricing:
      siteArchetype === "ecommerce"
        ? "retail pricing"
        : "demo-led software pricing",
    primaryCategory,
    primarySubcategory: topicNames[0] ?? primaryCategory,
    products: topicNames.slice(0, 5),
    reputationalQuestions: [],
    researchJourneys: [],
    secondaryCategories: [],
    siteArchetype,
    targetAudiences: [],
    targetCustomers: [inferTargetCustomer(input.description)],
    warnings: [],
  })
}

function dedupeCompetitors(competitors: OnboardingCompetitor[]) {
  const seen = new Set<string>()

  return competitors.filter((competitor) => {
    const key = `${competitor.name.trim().toLowerCase()}|${competitor.website
      .trim()
      .toLowerCase()}`

    if (!competitor.name.trim() || !competitor.website.trim() || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function getGenerationConfig(config?: CatalogGenerationConfig) {
  return {
    promptsPerTopic: config?.promptsPerTopic ?? DEFAULT_PROMPTS_PER_TOPIC,
    topicCountRange: config?.topicCountRange ?? DEFAULT_TOPIC_COUNT_RANGE,
  }
}

function formatGeoPromptStrategy(
  geoPromptStrategy: OnboardingEnhancedBrandProfile["geoPromptStrategy"] | undefined
) {
  if (!geoPromptStrategy) {
    return "Geo prompt strategy guidance:\n(none)"
  }

  const recommendedClusters =
    geoPromptStrategy.recommendedTopicClusters.length > 0
      ? geoPromptStrategy.recommendedTopicClusters.map((cluster) =>
          [
            `- ${cluster.name}`,
            `  Description: ${cluster.description}`,
            `  Intents: ${cluster.promptIntentsToInclude.join(", ") || "(none)"}`,
            `  Why it matters: ${cluster.whyThisClusterMatters}`,
          ].join("\n")
        )
      : ["(none)"]

  return [
    "Geo prompt strategy guidance:",
    "Recommended topic clusters:",
    ...recommendedClusters,
    `Include competitor-specific prompts: ${geoPromptStrategy.competitorPromptGuidance.shouldIncludeCompetitorSpecificPrompts ? "yes" : "no"}`,
    `Recommended competitor prompt share: ${geoPromptStrategy.competitorPromptGuidance.recommendedCompetitorPromptShare || "(none)"}`,
    `Competitors to prioritize: ${geoPromptStrategy.competitorPromptGuidance.competitorsToPrioritize.join(", ") || "(none)"}`,
    `Comparison angles: ${geoPromptStrategy.competitorPromptGuidance.comparisonAngles.join(", ") || "(none)"}`,
  ].join("\n")
}

export function countCatalogPrompts(catalog: OnboardingCatalog) {
  return catalog.topics.reduce((total, topic) => total + topic.prompts.length, 0)
}

export function normalizeScrapedPagesForGeneration(
  pages: NormalizedScrapedPage[] | undefined
) {
  if (!pages || pages.length === 0) {
    return []
  }

  return uniqueBy(
    pages
      .map((page) => ({
        competitorCandidates: dedupeCompetitors(page.competitorCandidates ?? []),
        contentSnapshot: normalizeWhitespace(page.contentSnapshot ?? ""),
        entities: uniqueStrings(page.entities ?? []),
        evidenceSnippets: uniqueStrings(page.evidenceSnippets ?? []),
        intents: uniqueStrings(page.intents ?? []),
        pageType: normalizeWhitespace(page.pageType ?? "other") || "other",
        title: page.title ? normalizeWhitespace(page.title) : null,
        url: normalizePageUrl(page.url),
      }))
      .filter((page) => page.contentSnapshot || page.entities.length > 0),
    (page) => page.url
  )
}

function uniqueBy<T>(values: T[], getKey: (value: T) => string) {
  const seen = new Set<string>()

  return values.filter((value) => {
    const key = getKey(value)

    if (!key || seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

function buildCatalogSystemPrompt(input: {
  correctiveNote?: string
  promptsPerTopic: number
  topicCountRange: {
    max: number
    min: number
  }
}) {
  return buildGatewayStructuredOutputSystemPrompt([
    "You are generating a GEO prompt starter catalog grounded in scraped website evidence.",
    `Infer between ${input.topicCountRange.min} and ${input.topicCountRange.max} coherent topics.`,
    `Generate exactly ${input.promptsPerTopic} prompts per topic.`,
    "Most prompts should be brand-neutral so the catalog measures natural category demand and recommendation coverage.",
    "Include brand-aware, comparison, reputational, follow-up, and constraint-based coverage when the site evidence supports it.",
    "Generate transactional prompts only when the business model clearly supports a near-term conversion action.",
    "Generate local prompts only when geography or location matters to the offering.",
    "Never duplicate a topic name or prompt text.",
    "Respect locked topics and exclusions exactly.",
    "Return only the schema fields.",
    input.correctiveNote
      ? `Corrective retry note: ${input.correctiveNote}`
      : "",
  ])
}

function buildCatalogUserPrompt(input: {
  brandProfile: OnboardingBrandProfile
  companyName: string
  competitors: OnboardingCompetitor[]
  excludedPromptTexts: string[]
  geoPromptStrategy?: OnboardingEnhancedBrandProfile["geoPromptStrategy"]
  excludedTopicNames: string[]
  promptsPerTopic: number
  scrapedPages: ReturnType<typeof normalizeScrapedPagesForGeneration>
  topics: OnboardingTopicInput[]
  website: string
}) {
  const lockedTopicNames = input.topics
    .filter((topic) => topic.source === "user_added")
    .map((topic) => normalizeTopicName(topic.topicName))

  return [
    `Brand: ${normalizeWhitespace(input.companyName)}`,
    `Domain: ${normalizeDomain(input.website)}`,
    `Business type hint: ${input.brandProfile.siteArchetype}`,
    `Primary category: ${input.brandProfile.primaryCategory}`,
    `Secondary categories: ${input.brandProfile.secondaryCategories.join(", ") || "(none)"}`,
    `Target audiences: ${input.brandProfile.targetAudiences.join(", ") || "(none)"}`,
    `Target customers: ${input.brandProfile.targetCustomers.join(", ") || "(none)"}`,
    `Research journeys: ${input.brandProfile.researchJourneys.join(", ") || "(none)"}`,
    `Comparison sets: ${input.brandProfile.comparisonSets.join(", ") || "(none)"}`,
    `Reputational questions: ${input.brandProfile.reputationalQuestions.join(", ") || "(none)"}`,
    `Conversion moments: ${input.brandProfile.conversionMoments.join(", ") || "(none)"}`,
    `Differentiators: ${input.brandProfile.differentiators.join(", ") || "(none)"}`,
    `Competitors: ${input.competitors.map((competitor) => competitor.name).join(", ") || "(none)"}`,
    `Locked topic names: ${lockedTopicNames.join(", ") || "(none)"}`,
    `Excluded topic names: ${input.excludedTopicNames.join(", ") || "(none)"}`,
    `Excluded prompt texts: ${input.excludedPromptTexts.join(" | ") || "(none)"}`,
    `Prompt count per topic: ${input.promptsPerTopic}`,
    `Description: ${input.brandProfile.detailedDescription}`,
    "",
    formatGeoPromptStrategy(input.geoPromptStrategy),
    "",
    "Scraped pages:",
    ...input.scrapedPages.map(
      (page) =>
        [
          `URL: ${page.url}`,
          `Page type: ${page.pageType}`,
          `Title: ${page.title ?? "(untitled)"}`,
          `Entities: ${page.entities.join(", ") || "(none)"}`,
          `Intents: ${page.intents.join(", ") || "(none)"}`,
          `Competitor candidates: ${page.competitorCandidates.map((competitor) => competitor.name).join(", ") || "(none)"}`,
          `Evidence snippets: ${page.evidenceSnippets.join(" | ") || "(none)"}`,
          `Content snapshot: ${page.contentSnapshot}`,
        ].join("\n")
    ),
  ].join("\n")
}

function validateCatalog(
  catalog: OnboardingCatalog,
  input: {
    excludedPromptTexts: string[]
    excludedTopicNames: string[]
    promptsPerTopic: number
    topicCountRange: {
      max: number
      min: number
    }
    topics: OnboardingTopicInput[]
  }
) {
  const topicCount = catalog.topics.length
  const normalizedTopicNames = catalog.topics.map((topic) =>
    normalizeTopicName(topic.name)
  )
  const lockedTopicNames = input.topics
    .filter((topic) => topic.source === "user_added")
    .map((topic) => normalizeTopicName(topic.topicName))
  const excludedTopicNames = new Set(
    input.excludedTopicNames.map((topicName) => normalizeTopicName(topicName))
  )
  const excludedPromptTexts = new Set(
    input.excludedPromptTexts.map((promptText) => normalizePromptText(promptText))
  )

  if (
    topicCount < Math.max(input.topicCountRange.min, lockedTopicNames.length) ||
    topicCount > Math.max(input.topicCountRange.max, lockedTopicNames.length)
  ) {
    throw new Error(
      `Expected ${input.topicCountRange.min}-${input.topicCountRange.max} topics but received ${topicCount}.`
    )
  }

  if (new Set(normalizedTopicNames).size !== normalizedTopicNames.length) {
    throw new Error("Generated catalog contains duplicate topic names.")
  }

  for (const lockedTopicName of lockedTopicNames) {
    if (!normalizedTopicNames.includes(lockedTopicName)) {
      throw new Error(`Locked topic "${lockedTopicName}" is missing from the catalog.`)
    }
  }

  for (const topic of catalog.topics) {
    const normalizedTopicName = normalizeTopicName(topic.name)

    if (excludedTopicNames.has(normalizedTopicName)) {
      throw new Error(`Excluded topic "${normalizedTopicName}" was regenerated.`)
    }

    if (topic.prompts.length !== input.promptsPerTopic) {
      throw new Error(
        `Topic "${normalizedTopicName}" must contain exactly ${input.promptsPerTopic} prompts.`
      )
    }

    const normalizedPromptTexts = topic.prompts.map((prompt) =>
      normalizePromptText(prompt.text)
    )

    if (new Set(normalizedPromptTexts).size !== normalizedPromptTexts.length) {
      throw new Error(`Topic "${normalizedTopicName}" contains duplicate prompts.`)
    }

    for (const promptText of normalizedPromptTexts) {
      if (excludedPromptTexts.has(promptText)) {
        throw new Error(`Excluded prompt "${promptText}" was regenerated.`)
      }
    }
  }
}

async function retryCatalogGeneration(input: {
  brandProfile: OnboardingBrandProfile
  companyName: string
  competitors: OnboardingCompetitor[]
  excludedPromptTexts: string[]
  geoPromptStrategy?: OnboardingEnhancedBrandProfile["geoPromptStrategy"]
  excludedTopicNames: string[]
  promptsPerTopic: number
  scrapedPages: ReturnType<typeof normalizeScrapedPagesForGeneration>
  topics: OnboardingTopicInput[]
  topicCountRange: {
    max: number
    min: number
  }
  website: string
}) {
  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const { output } = await generateText({
        model: getLanguageModel("openai", {
          capability: "structuredOutput",
          modelId: DEFAULT_STRUCTURED_OUTPUT_MODEL_ID,
        }),
        output: createGatewayStructuredObjectOutput({
          description:
            "Structured GEO prompt starter catalog grouped into coherent topics.",
          name: "onboarding_geo_prompt_catalog",
          schema: onboardingGatewayCatalogSchema,
        }),
        prompt: buildCatalogUserPrompt({
          brandProfile: input.brandProfile,
          companyName: input.companyName,
          competitors: input.competitors,
          excludedPromptTexts: input.excludedPromptTexts,
          geoPromptStrategy: input.geoPromptStrategy,
          excludedTopicNames: input.excludedTopicNames,
          promptsPerTopic: input.promptsPerTopic,
          scrapedPages: input.scrapedPages,
          topics: input.topics,
          website: input.website,
        }),
        system: buildCatalogSystemPrompt({
          correctiveNote: lastError?.message,
          promptsPerTopic: input.promptsPerTopic,
          topicCountRange: input.topicCountRange,
        }),
        temperature: 0,
      })

      const catalog = onboardingCatalogSchema.parse(output)

      validateCatalog(catalog, {
        excludedPromptTexts: input.excludedPromptTexts,
        excludedTopicNames: input.excludedTopicNames,
        promptsPerTopic: input.promptsPerTopic,
        topicCountRange: input.topicCountRange,
        topics: input.topics,
      })

      return catalog
    } catch (error) {
      lastError =
        error instanceof Error
          ? error
          : new Error("Catalog generation failed for an unknown reason.")
    }
  }

  throw new Error("Unable to generate a valid onboarding GEO catalog after 2 attempts.")
}

function toPromptDraft(input: {
  analysisRunId?: string
  catalog: OnboardingCatalog
  prompt: OnboardingCatalog["topics"][number]["prompts"][number]
  sourceUrls: string[]
  topic: OnboardingCatalog["topics"][number]
}): OnboardingPromptDraft {
  const generationMetadata = {
    brand: input.catalog.brand,
    businessType: input.catalog.businessType,
    domain: input.catalog.domain,
    evidenceUrls: [],
    primaryCategory: input.catalog.primaryCategory,
    sourceUrls: input.sourceUrls,
    topicDescription: input.topic.description,
    topicId: input.topic.id,
    topicName: normalizeTopicName(input.topic.name),
  }

  return {
    addedVia: "ai_suggested",
    generationMetadata,
    intent: input.prompt.intent,
    promptText: normalizeWhitespace(input.prompt.text),
    scoreMetadata: {
      generation: {
        ...generationMetadata,
        intent: input.prompt.intent,
      },
    },
    scoreStatus: "unscored",
    sourceAnalysisRunId: input.analysisRunId,
    variantType: undefined,
  }
}

export function catalogToTopicDrafts(input: {
  analysisRunId?: string
  catalog: OnboardingCatalog
  scrapedPages: ReturnType<typeof normalizeScrapedPagesForGeneration>
  topics: OnboardingTopicInput[]
}) {
  const inputTopicsByNormalizedName = new Map(
    input.topics.map((topic) => [normalizeTopicName(topic.topicName), topic])
  )
  const defaultSourceUrls = input.scrapedPages.slice(0, 3).map((page) => page.url)

  return input.catalog.topics.map((topic) => {
    const normalizedTopicName = normalizeTopicName(topic.name)
    const sourceTopic = inputTopicsByNormalizedName.get(normalizedTopicName)
    const sourceUrls =
      sourceTopic?.sourceUrls && sourceTopic.sourceUrls.length > 0
        ? sourceTopic.sourceUrls
        : defaultSourceUrls

    return {
      clusterId: topic.id,
      intentSummary: `GEO coverage for ${normalizedTopicName}`,
      prompts: topic.prompts.map((prompt) =>
        toPromptDraft({
          analysisRunId: input.analysisRunId,
          catalog: input.catalog,
          prompt,
          sourceUrls,
          topic,
        })
      ),
      source: sourceTopic?.source ?? "ai_suggested",
      sourceUrls,
      topicDescription: topic.description,
      topicName: normalizedTopicName,
    } satisfies OnboardingTopicDraft
  })
}

export async function generateTopicPromptDrafts(input: {
  analysisRunId?: string
  brandProfile?: OnboardingBrandProfile
  companyName: string
  competitors: OnboardingCompetitor[]
  description: string
  generationConfig?: CatalogGenerationConfig
  geoPromptStrategy?: OnboardingEnhancedBrandProfile["geoPromptStrategy"]
  intentSummary?: string
  scrapedPages?: NormalizedScrapedPage[]
  sourceUrls?: string[]
  topicName: string
  topicSource: OnboardingTopicInput["source"]
  website: string
}): Promise<OnboardingTopicDraft> {
  const result = await generateTopicPromptCollection({
    analysisRunId: input.analysisRunId ?? "",
    brandProfile: input.brandProfile,
    companyName: input.companyName,
    competitors: input.competitors,
    description: input.description,
    generationConfig: input.generationConfig,
    geoPromptStrategy: input.geoPromptStrategy,
    scrapedPages: input.scrapedPages,
    topics: [
      {
        intentSummary: input.intentSummary,
        source: input.topicSource,
        sourceUrls: input.sourceUrls ?? [],
        topicName: input.topicName,
      },
    ],
    website: input.website,
  })

  return (
    result.topics[0] ?? {
      intentSummary: input.intentSummary,
      prompts: [],
      source: input.topicSource,
      sourceUrls: input.sourceUrls ?? [],
      topicDescription: "",
      topicName: normalizeTopicName(input.topicName),
    }
  )
}

export async function generateTopicPromptCollection(
  input: TopicPromptGenerationInput
): Promise<OnboardingTopicPromptResponse> {
  const brandProfile =
    input.brandProfile ??
    buildFallbackBrandProfile({
      companyName: input.companyName,
      description: input.description,
      topics: input.topics ?? [],
      website: input.website,
    })
  const scrapedPages = normalizeScrapedPagesForGeneration(input.scrapedPages)
  const generationConfig = getGenerationConfig(input.generationConfig)
  const catalog = await retryCatalogGeneration({
    brandProfile,
    companyName: input.companyName,
    competitors: dedupeCompetitors(input.competitors),
    excludedPromptTexts: input.excludedPromptTexts ?? [],
    geoPromptStrategy: input.geoPromptStrategy,
    excludedTopicNames: input.excludedTopicNames ?? [],
    promptsPerTopic: generationConfig.promptsPerTopic,
    scrapedPages,
    topics: input.topics ?? [],
    topicCountRange: generationConfig.topicCountRange,
    website: input.website,
  })

  return {
    catalog,
    topics: catalogToTopicDrafts({
      analysisRunId: input.analysisRunId,
      catalog,
      scrapedPages,
      topics: input.topics ?? [],
    }),
    warnings: uniqueStrings(brandProfile.warnings),
  }
}
