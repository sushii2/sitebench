import { generateText } from "ai"

import {
  buildGatewayStructuredOutputSystemPrompt,
  createGatewayStructuredObjectOutput,
} from "@/lib/ai/gateway-structured-output"
import {
  normalizeBrandTopics,
  normalizeWebsite,
} from "@/lib/brands"
import { getLanguageModel } from "@/lib/ai/provider-config"
import {
  buildDeterministicPromptTemplates,
  normalizePromptEntityName,
} from "@/lib/onboarding/topic-prompt-templates"
import type {
  OnboardingBrandProfile,
  OnboardingCompetitor,
  OnboardingPromptGenerationCandidate,
  OnboardingTopicDraft,
  OnboardingTopicInput,
  OnboardingTopicPromptRequest,
  OnboardingTopicPromptResponse,
} from "@/lib/onboarding/types"
import {
  onboardingBrandProfileSchema,
  onboardingGatewayPromptGenerationSchema,
} from "@/lib/onboarding/types"

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean))]
}

function normalizeTopicName(value: string) {
  return normalizeBrandTopics([value])[0] ?? normalizeWhitespace(value)
}

function inferTargetCustomer(description: string) {
  const match = description.match(
    /\b(enterprise security teams?|security teams?|marketing teams?|brand teams?|engineering teams?|developer teams?|ecommerce teams?|retail shoppers?|buyers?)\b/i
  )

  return normalizeWhitespace(match?.[0] ?? "buyers")
}

function buildFallbackBrandProfile(
  input: Pick<
    OnboardingTopicPromptRequest,
    "companyName" | "description" | "topics" | "website"
  >
): OnboardingBrandProfile {
  const normalizedWebsite = normalizeWebsite(input.website)
  const topicNames = normalizeBrandTopics(input.topics.map((topic) => topic.topicName))
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
    detailedDescription: normalizeWhitespace(input.description),
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
    siteArchetype,
    targetCustomers: [inferTargetCustomer(input.description)],
    warnings: [],
  })
}

function buildPromptGenerationPrompt(input: {
  brandProfile: OnboardingBrandProfile
  companyName: string
  competitors: OnboardingCompetitor[]
  topics: Array<
    OnboardingTopicInput & {
      intentSummary?: string
      sourceUrls?: string[]
    }
  >
  website: string
}) {
  const competitorNames = input.competitors
    .map((competitor) => normalizePromptEntityName(competitor.name))
    .join(", ")

  return [
    `Company: ${normalizePromptEntityName(input.companyName)}`,
    `Website: ${normalizeWebsite(input.website)}`,
    `Site archetype: ${input.brandProfile.siteArchetype}`,
    `Primary category: ${input.brandProfile.primaryCategory}`,
    `Primary subcategory: ${input.brandProfile.primarySubcategory || "(none)"}`,
    `Categories: ${input.brandProfile.categories.join(", ")}`,
    `Target customers: ${input.brandProfile.targetCustomers.join(", ") || "(none)"}`,
    `Jobs to be done: ${input.brandProfile.jobsToBeDone.join(", ") || "(none)"}`,
    `Products: ${input.brandProfile.products.join(", ") || "(none)"}`,
    `Pricing: ${input.brandProfile.pricing}`,
    `Geography: ${input.brandProfile.geography ?? "(unknown)"}`,
    `Competitors: ${competitorNames || "(none)"}`,
    `Description: ${input.brandProfile.detailedDescription}`,
    "",
    "Topics:",
    ...input.topics.map(
      (topic, index) =>
        `Topic ${index + 1}: ${normalizeTopicName(topic.topicName)}\nIntent summary: ${
          topic.intentSummary ?? "(none)"
        }\nSource URLs: ${topic.sourceUrls?.join(", ") || "(none)"}`
    ),
  ].join("\n")
}

function toPromptDraft(input: {
  analysisRunId?: string
  candidate: OnboardingPromptGenerationCandidate
}) {
  return {
    addedVia: "ai_suggested" as const,
    promptText: normalizeWhitespace(input.candidate.promptText),
    scoreMetadata: {
      category: input.candidate.category,
      constraint: input.candidate.constraint,
      context: input.candidate.context,
      goal: input.candidate.goal,
      persona: input.candidate.persona,
    },
    scoreStatus: "unscored" as const,
    sourceAnalysisRunId: input.analysisRunId,
    templateText:
      "{goal} + {category} + {persona} + {constraint} + {context}",
    variantType: input.candidate.variantType,
  }
}

function buildFallbackPromptCandidates(input: {
  analysisRunId?: string
  brandProfile: OnboardingBrandProfile
  companyName: string
  competitors: OnboardingCompetitor[]
  topic: OnboardingTopicInput & {
    intentSummary?: string
    sourceUrls?: string[]
  }
}): OnboardingTopicDraft {
  const prompts = buildDeterministicPromptTemplates({
    brandProfile: input.brandProfile,
    companyName: input.companyName,
    competitors: input.competitors,
    topic: input.topic,
  }).map((candidate) =>
    toPromptDraft({
      analysisRunId: input.analysisRunId,
      candidate,
    })
  )

  return {
    clusterId: input.topic.clusterId,
    intentSummary: input.topic.intentSummary,
    prompts,
    source: input.topic.source,
    sourceUrls: input.topic.sourceUrls ?? [],
    topicName: normalizeTopicName(input.topic.topicName),
  }
}

export async function generateTopicPromptDrafts(input: {
  analysisRunId?: string
  brandProfile?: OnboardingBrandProfile
  companyName: string
  competitors: OnboardingCompetitor[]
  description: string
  intentSummary?: string
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
    result.topics[0] ??
    buildFallbackPromptCandidates({
      analysisRunId: input.analysisRunId,
      brandProfile:
        input.brandProfile ??
        buildFallbackBrandProfile({
          companyName: input.companyName,
          description: input.description,
          topics: [{ source: input.topicSource, topicName: input.topicName }],
          website: input.website,
        }),
      companyName: input.companyName,
      competitors: input.competitors,
      topic: {
        intentSummary: input.intentSummary,
        source: input.topicSource,
        sourceUrls: input.sourceUrls ?? [],
        topicName: input.topicName,
      },
    })
  )
}

export async function generateTopicPromptCollection(
  input: Pick<
    OnboardingTopicPromptRequest,
    | "analysisRunId"
    | "brandProfile"
    | "companyName"
    | "competitors"
    | "description"
    | "topics"
    | "website"
  >
): Promise<OnboardingTopicPromptResponse> {
  const brandProfile =
    input.brandProfile ??
    buildFallbackBrandProfile({
      companyName: input.companyName,
      description: input.description,
      topics: input.topics,
      website: input.website,
    })

  normalizeWebsite(input.website)

  try {
    const { output } = await generateText({
      model: getLanguageModel("openai", {
        capability: "structuredOutput",
      }),
      output: createGatewayStructuredObjectOutput({
        description:
          "Structured topic-specific onboarding prompts grounded in the supplied brand profile and topic intent.",
        name: "onboarding_topic_prompt_collection",
        schema: onboardingGatewayPromptGenerationSchema,
      }),
      prompt: buildPromptGenerationPrompt({
        brandProfile,
        companyName: input.companyName,
        competitors: input.competitors,
        topics: input.topics,
        website: input.website,
      }),
      system: buildGatewayStructuredOutputSystemPrompt([
        "You are an onboarding prompt generation assistant.",
        "Generate realistic prompts using the formula goal + category + persona + constraint + context.",
        "Ground every prompt in the supplied brand profile, topic intent, and source URLs.",
        "Use category or subcategory context that matches each topic instead of a single global label.",
        "Choose personas that reflect the likely decision maker or shopper.",
        "Constraints must reflect real evaluation friction like price, fit, implementation risk, integrations, migration effort, compliance, shipping region, or team size.",
        "Prompt text should sound like something a real buyer would type into ChatGPT, Perplexity, or Google AI search.",
        "Avoid branded filler, analyst phrasing, SEO fragments, and vague one-word topics.",
        "Make each prompt specific enough that a ranked answer could clearly compare vendors, approaches, tradeoffs, or implementation paths.",
        "Return one topic entry per input topic in the same order.",
        "For each topic, generate 2 to 3 prompts when possible.",
        "Return only the schema fields.",
      ]),
      temperature: 0,
    })

    const generatedTopics = onboardingGatewayPromptGenerationSchema.parse(output).topics
    const topics = input.topics.map((topic, index) => {
      const generatedTopic =
        generatedTopics[index] ??
        generatedTopics.find(
          (candidate) =>
            normalizeTopicName(candidate.topicName) === normalizeTopicName(topic.topicName)
        )

      if (!generatedTopic) {
        return buildFallbackPromptCandidates({
          analysisRunId: input.analysisRunId,
          brandProfile,
          companyName: input.companyName,
          competitors: input.competitors,
          topic,
        })
      }

      return {
        clusterId: topic.clusterId,
        intentSummary: topic.intentSummary,
        prompts: generatedTopic.prompts.map((candidate) =>
          toPromptDraft({
            analysisRunId: input.analysisRunId,
            candidate,
          })
        ),
        source: topic.source,
        sourceUrls: topic.sourceUrls ?? [],
        topicName: normalizeTopicName(generatedTopic.topicName),
      } satisfies OnboardingTopicDraft
    })

    return {
      topics,
      warnings: brandProfile.warnings,
    }
  } catch (error) {
    console.warn("[onboarding] Prompt generation fallback", error)

    return {
      topics: input.topics.map((topic) =>
        buildFallbackPromptCandidates({
          analysisRunId: input.analysisRunId,
          brandProfile,
          companyName: input.companyName,
          competitors: input.competitors,
          topic,
        })
      ),
      warnings: uniqueStrings([
        ...brandProfile.warnings,
        "We could not fully tailor prompt suggestions, so we used a lighter fallback.",
      ]),
    }
  }
}
