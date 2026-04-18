import type { JSONSchema7 } from "@ai-sdk/provider"
import { Output, generateText, jsonSchema } from "ai"

import {
  normalizeBrandTopics,
  normalizeCompanyName,
  normalizeWebsite,
} from "@/lib/brands"
import { getLanguageModel } from "@/lib/ai/provider-config"
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
  onboardingGatewayPromptGenerationSchema,
} from "@/lib/onboarding/types"

const PROMPT_VARIANT_VALUES = [
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

const PROMPT_INTENT_VALUES = [
  "category_discovery",
  "recommendation",
  "comparison",
  "alternatives",
  "problem_solving",
  "best_practices",
  "pricing",
  "implementation",
] as const

const PURCHASE_STAGE_VALUES = [
  "discovery",
  "consideration",
  "decision",
] as const

const BRAND_RELEVANCE_VALUES = ["direct", "indirect", "adjacent"] as const
const COMMERCIAL_VALUE_VALUES = ["high", "medium", "low"] as const

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => normalizeWhitespace(value)).filter(Boolean))]
}

function normalizeTopicName(value: string) {
  return normalizeBrandTopics([value])[0] ?? ""
}

function normalizeCompetitorNames(competitors: OnboardingCompetitor[]) {
  return uniqueStrings(
    competitors.flatMap((competitor) => {
      try {
        return [normalizeCompanyName(competitor.name)]
      } catch {
        return [normalizeWhitespace(competitor.name)]
      }
    })
  )
}

function normalizeEntityName(value: string) {
  try {
    return normalizeCompanyName(value)
  } catch {
    return normalizeWhitespace(value)
  }
}

function inferAudience(description: string) {
  const match = description.match(
    /\b(enterprise marketing teams?|marketing teams?|brand teams?|developer teams?|engineering teams?|product teams?|sales teams?|ecommerce teams?)\b/i
  )

  return normalizeWhitespace(match?.[0] ?? "software teams")
}

function buildFallbackBrandProfile(
  input: Pick<
    OnboardingTopicPromptRequest,
    "companyName" | "competitors" | "description" | "topics" | "website"
  >
): OnboardingBrandProfile {
  const normalizedWebsite = normalizeWebsite(input.website)
  const audiences = uniqueStrings([inferAudience(input.description)])
  const topicNames = normalizeBrandTopics(input.topics.map((topic) => topic.topicName)).slice(0, 5)
  const productCategories = topicNames.length > 0 ? topicNames : ["software"]

  return {
    adjacentCategories: [],
    category: normalizeWhitespace(topicNames[0] ?? "software"),
    competitors: input.competitors,
    description: normalizeWhitespace(input.description),
    differentiators: [],
    evidenceUrls: [normalizedWebsite],
    productCategories,
    targetAudiences: audiences,
    topUseCases: topicNames.length > 0 ? topicNames : ["vendor evaluation"],
    warnings: [],
  }
}

function buildPromptGenerationSchema() {
  const schema: JSONSchema7 = {
    $schema: "http://json-schema.org/draft-07/schema#",
    additionalProperties: false,
    properties: {
      topics: {
        items: {
          additionalProperties: false,
          properties: {
            prompts: {
              items: {
                additionalProperties: false,
                properties: {
                  brandRelevance: {
                    enum: [...BRAND_RELEVANCE_VALUES],
                    type: "string",
                  },
                  commercialValue: {
                    enum: [...COMMERCIAL_VALUE_VALUES],
                    type: "string",
                  },
                  intentType: {
                    enum: [...PROMPT_INTENT_VALUES],
                    type: "string",
                  },
                  likelyCompetitors: {
                    items: {
                      type: "string",
                    },
                    type: "array",
                  },
                  persona: {
                    type: "string",
                  },
                  promptText: {
                    type: "string",
                  },
                  purchaseStage: {
                    enum: [...PURCHASE_STAGE_VALUES],
                    type: "string",
                  },
                  rationale: {
                    type: "string",
                  },
                  segment: {
                    type: "string",
                  },
                  templateText: {
                    type: "string",
                  },
                  variantType: {
                    enum: [...PROMPT_VARIANT_VALUES],
                    type: "string",
                  },
                },
                required: [
                  "brandRelevance",
                  "commercialValue",
                  "intentType",
                  "likelyCompetitors",
                  "persona",
                  "promptText",
                  "purchaseStage",
                  "rationale",
                  "segment",
                  "templateText",
                  "variantType",
                ],
                type: "object",
              },
              minItems: 2,
              type: "array",
            },
            topicName: {
              type: "string",
            },
          },
          required: ["topicName", "prompts"],
          type: "object",
        },
        minItems: 1,
        type: "array",
      },
    },
    required: ["topics"],
    type: "object",
  }

  return jsonSchema(schema, {
    validate: async (value) => {
      const parsed = onboardingGatewayPromptGenerationSchema.safeParse(value)

      return parsed.success
        ? { success: true, value: parsed.data }
        : { success: false, error: parsed.error }
    },
  })
}

function buildPromptGenerationPrompt(input: {
  brandProfile: OnboardingBrandProfile
  companyName: string
  topics: Array<
    OnboardingTopicInput & {
      intentSummary?: string
      sourceUrls?: string[]
    }
  >
  website: string
}) {
  const brandProfile = input.brandProfile
  const competitorNames = normalizeCompetitorNames(brandProfile.competitors)

  return [
    `Company: ${normalizeEntityName(input.companyName)}`,
    `Website: ${normalizeWebsite(input.website)}`,
    `Category: ${brandProfile.category}`,
    `Product categories: ${
      brandProfile.productCategories.length > 0
        ? brandProfile.productCategories.join(", ")
        : "(none)"
    }`,
    `Target audiences: ${
      brandProfile.targetAudiences.length > 0
        ? brandProfile.targetAudiences.join(", ")
        : "(none)"
    }`,
    `Top use cases: ${
      brandProfile.topUseCases.length > 0
        ? brandProfile.topUseCases.join(", ")
        : "(none)"
    }`,
    `Differentiators: ${
      brandProfile.differentiators.length > 0
        ? brandProfile.differentiators.join(", ")
        : "(none)"
    }`,
    `Adjacent categories: ${
      brandProfile.adjacentCategories.length > 0
        ? brandProfile.adjacentCategories.join(", ")
        : "(none)"
    }`,
    `Competitors: ${competitorNames.length > 0 ? competitorNames.join(", ") : "(none)"}`,
    "",
    "Topics:",
    ...input.topics.map(
      (topic, index) =>
        `Topic ${index + 1}: ${topic.topicName}\nIntent summary: ${topic.intentSummary ?? "(none)"}\nSource URLs: ${
          topic.sourceUrls?.length ? topic.sourceUrls.join(", ") : "(none)"
        }`
    ),
  ].join("\n")
}

function buildFallbackPromptCandidates(input: {
  analysisRunId?: string
  brandProfile: OnboardingBrandProfile
  companyName: string
  topic: OnboardingTopicInput & {
    intentSummary?: string
    sourceUrls?: string[]
  }
}): OnboardingTopicDraft {
  const audience = input.brandProfile.targetAudiences[0] ?? inferAudience(input.brandProfile.description)
  const competitor = input.brandProfile.competitors[0]?.name ?? "leading competitors"
  const normalizedTopicName = normalizeTopicName(input.topic.topicName)
  const topicLabel = normalizedTopicName || normalizeWhitespace(input.topic.topicName)
  const prompts = [
    {
      addedVia: "ai_suggested" as const,
      promptText: `What are the best ${topicLabel} options for ${audience}?`,
      scoreMetadata: {
        brandRelevance: "direct",
        commercialValue: "medium",
        intentType: "recommendation",
        persona: audience,
        purchaseStage: "consideration",
        segment: audience,
      },
      scoreStatus: "unscored" as const,
      sourceAnalysisRunId: input.analysisRunId,
      templateText: "What are the best {topic} options for {audience}?",
      variantType: "alternatives" as const,
    },
    {
      addedVia: "ai_suggested" as const,
      promptText: `${normalizeEntityName(input.companyName)} vs ${competitor} for ${topicLabel}`,
      scoreMetadata: {
        brandRelevance: "direct",
        commercialValue: "high",
        intentType: "comparison",
        persona: audience,
        purchaseStage: "decision",
        segment: audience,
      },
      scoreStatus: "unscored" as const,
      sourceAnalysisRunId: input.analysisRunId,
      templateText: "{company} vs {competitor} for {topic}",
      variantType: "comparison" as const,
    },
  ]

  return {
    intentSummary: input.topic.intentSummary,
    prompts,
    source: input.topic.source,
    sourceUrls: input.topic.sourceUrls ?? [],
    topicName: topicLabel,
  }
}

function toPromptDraft(input: {
  analysisRunId?: string
  candidate: OnboardingPromptGenerationCandidate
}) {
  return {
    addedVia: "ai_suggested" as const,
    promptText: normalizeWhitespace(input.candidate.promptText),
    scoreMetadata: {
      brandRelevance: input.candidate.brandRelevance,
      commercialValue: input.candidate.commercialValue,
      intentType: input.candidate.intentType,
      likelyCompetitors: input.candidate.likelyCompetitors,
      persona: input.candidate.persona,
      purchaseStage: input.candidate.purchaseStage,
      rationale: input.candidate.rationale,
      segment: input.candidate.segment,
    },
    scoreStatus: "unscored" as const,
    sourceAnalysisRunId: input.analysisRunId,
    templateText: normalizeWhitespace(input.candidate.templateText),
    variantType: input.candidate.variantType,
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
          competitors: input.competitors,
          description: input.description,
          topics: [
            {
              source: input.topicSource,
              topicName: input.topicName,
            },
          ],
          website: input.website,
        }),
      companyName: input.companyName,
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
      competitors: input.competitors,
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
      output: Output.object({
        schema: buildPromptGenerationSchema(),
      }),
      prompt: buildPromptGenerationPrompt({
        brandProfile,
        companyName: input.companyName,
        topics: input.topics,
        website: input.website,
      }),
      system: [
        "You are an onboarding prompt generation assistant.",
        "Generate realistic, commercially relevant prompts for buyer research, vendor evaluation, implementation, and competitor discovery.",
        "Use the structured brand profile plus the supplied topics.",
        "Think in demand scenarios, not website copy.",
        "Avoid generic definitional questions, vague filler, and prompts that only restate the topic.",
        "Return one topic entry for every input topic in the same order.",
        "For each topic, generate 5 to 6 prompts when possible.",
        "Use variant types only when they fit the prompt.",
        "Return only the schema fields.",
      ].join(" "),
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
          topic,
        })
      }

      return {
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
