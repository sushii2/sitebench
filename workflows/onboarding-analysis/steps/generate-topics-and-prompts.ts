import { generateText } from "ai"

import {
  buildGatewayStructuredOutputSystemPrompt,
  createGatewayStructuredObjectOutput,
} from "@/lib/ai/gateway-structured-output"
import { normalizeBrandTopics } from "@/lib/brands"
import { getLanguageModel } from "@/lib/ai/provider-config"
import { generateTopicPromptCollection } from "@/lib/onboarding/topic-prompt-generator"
import {
  onboardingGatewayTopicClusterSchema,
  onboardingTopicClusterSchema,
} from "@/lib/onboarding/types"

import {
  extendTimings,
  logStepError,
  persistRunPhase,
  toErrorWarning,
  uniqueWarnings,
} from "@/workflows/onboarding-analysis/steps/shared"
import type {
  CompetitorState,
  PromptedState,
} from "@/workflows/onboarding-analysis/types"

function toClusterId(topicName: string) {
  return topicName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

function buildFallbackTopics(input: CompetitorState) {
  const topicNames = normalizeBrandTopics([
    input.brandProfile.primarySubcategory,
    input.brandProfile.primaryCategory,
    ...input.brandProfile.categories,
    ...input.brandProfile.jobsToBeDone,
    ...input.brandProfile.products,
  ]).slice(0, 7)

  return onboardingTopicClusterSchema.parse({
    topics: topicNames.map((topicName) => ({
      clusterId: toClusterId(topicName) || "topic_cluster",
      intentSummary: `Buyer evaluation of ${topicName}`,
      source: "ai_suggested",
      sourceUrls: input.scrapedPages.slice(0, 2).map((page) => page.url),
      topicName,
    })),
  }).topics
}

export async function generateTopicsAndPromptsStep(
  input: CompetitorState
): Promise<PromptedState> {
  "use step"

  const startedAt = Date.now()
  let warnings = [...input.warnings]
  let topics = buildFallbackTopics(input)

  try {
    const { output } = await generateText({
      model: getLanguageModel("openai", {
        capability: "structuredOutput",
      }),
      output: createGatewayStructuredObjectOutput({
        description:
          "Structured onboarding topic clusters with stable cluster IDs, intent summaries, sources, and source URLs.",
        name: "onboarding_topic_clusters",
        schema: onboardingGatewayTopicClusterSchema,
      }),
      prompt: [
        `Company: ${input.companyName}`,
        `Website: ${input.website}`,
        `Archetype: ${input.brandProfile.siteArchetype}`,
        `Primary category: ${input.brandProfile.primaryCategory}`,
        `Primary subcategory: ${input.brandProfile.primarySubcategory}`,
        `Target customers: ${input.brandProfile.targetCustomers.join(", ")}`,
        `Jobs to be done: ${input.brandProfile.jobsToBeDone.join(", ")}`,
        `Products: ${input.brandProfile.products.join(", ")}`,
        `Evidence URLs: ${input.scrapedPages.slice(0, 10).map((page) => page.url).join(", ")}`,
      ].join("\n"),
      system: buildGatewayStructuredOutputSystemPrompt([
        "Generate 5 to 7 buyer-facing onboarding topic clusters grounded in the brand profile.",
        "Use categories, personas, jobs to be done, pricing, and product families.",
        "clusterId must be a stable lowercase snake_case identifier derived from topicName.",
        "intentSummary must explain the buyer question or evaluation intent in one sentence.",
        "sourceUrls must contain 1 to 3 of the most relevant evidence URLs from the supplied list.",
        "topicName should be concise, non-branded when possible, and useful as a reusable monitoring cluster label.",
        "Return only the schema fields.",
      ]),
      temperature: 0,
    })

    const generatedTopics = onboardingTopicClusterSchema.parse(output).topics

    if (generatedTopics.length > 0) {
      topics = generatedTopics
    }
  } catch (error) {
    warnings = uniqueWarnings([
      ...warnings,
      toErrorWarning(
        "We could not fully generate topic clusters, so we used a deterministic fallback.",
        error
      ),
    ])
    logStepError("Workflow topic generation failed", error, {
      analysisId: input.analysisId,
      website: input.website,
    })
  }

  const promptCollection = await generateTopicPromptCollection({
    analysisRunId: input.analysisId,
    brandProfile: input.brandProfile,
    companyName: input.companyName,
    competitors: input.competitors,
    description: input.brandProfile.detailedDescription,
    topics,
    website: input.website,
  })
  const result = {
    brandProfile: {
      ...input.brandProfile,
      warnings: uniqueWarnings([
        ...input.brandProfile.warnings,
        ...warnings,
        ...promptCollection.warnings,
      ]),
    },
    competitors: input.competitors,
    description: input.brandProfile.detailedDescription,
    topics: promptCollection.topics,
    warnings: uniqueWarnings([
      ...warnings,
      ...promptCollection.warnings,
    ]),
  }

  await persistRunPhase({
    analysisId: input.analysisId,
    authToken: input.authToken,
    status: "prompting",
    warnings: result.warnings,
  })

  return {
    ...input,
    result,
    timings: extendTimings(input.timings, "generateTopicsAndPromptsMs", startedAt),
    topics: promptCollection.topics,
    warnings: result.warnings,
  }
}
