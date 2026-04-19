import { generateText } from "ai"

import {
  buildGatewayStructuredOutputSystemPrompt,
  createGatewayStructuredObjectOutput,
} from "@/lib/ai/gateway-structured-output"
import { getLanguageModel } from "@/lib/ai/provider-config"
import {
  onboardingGatewayHomepageClassificationSchema,
  onboardingHomepageClassificationSchema,
} from "@/lib/onboarding/types"

import {
  extendTimings,
  logStepError,
  persistRunPhase,
  stripMarkdown,
  toErrorWarning,
  uniqueWarnings,
} from "@/workflows/onboarding-analysis/steps/shared"
import type {
  ClassifiedState,
  HomepageState,
} from "@/workflows/onboarding-analysis/types"

function inferFallbackClassification(input: HomepageState) {
  const mappedUrls = input.mappedPages.map((page) => page.url.toLowerCase())
  const content = stripMarkdown(input.homepage?.markdown ?? "")
  const combined = `${mappedUrls.join(" ")} ${content}`
  const isEcommerce =
    /\b(collection|collections|sale|shop|store|women|men|shoes|cart|checkout)\b/.test(
      combined
    )
  const isDeveloperTool =
    /\b(api|sdk|developers?|docs|integration|webhook)\b/.test(combined)
  const hasMultipleProductFamilies =
    mappedUrls.filter((url) => /\/solutions\/|\/products\/|\/platform\//.test(url)).length >=
    2
  const siteArchetype = isEcommerce
    ? "ecommerce"
    : hasMultipleProductFamilies
      ? "multi_product"
      : isDeveloperTool
        ? "developer_tool"
        : "saas"
  const categories = isEcommerce
    ? ["retail products"]
    : isDeveloperTool
      ? ["developer tooling"]
      : ["software"]

  return onboardingHomepageClassificationSchema.parse({
    buyerLanguage: [],
    categories,
    pageEquivalentPatterns: mappedUrls
      .map((url) => new URL(url).pathname.split("/").filter(Boolean)[0] ?? "")
      .filter(Boolean)
      .slice(0, 8),
    personas: [],
    pricingModel: isEcommerce ? "retail pricing" : "demo-led pricing",
    primaryCategory: categories[0],
    primarySubcategory: categories[0],
    secondaryCategories: [],
    siteArchetype,
  })
}

export async function classifyHomepageStep(
  input: HomepageState
): Promise<ClassifiedState> {
  "use step"

  const startedAt = Date.now()
  let warnings = [...input.warnings]
  let homepageClassification = inferFallbackClassification(input)

  try {
    if (input.homepage) {
      const { output } = await generateText({
        model: getLanguageModel("openai", {
          capability: "structuredOutput",
        }),
        output: createGatewayStructuredObjectOutput({
          description:
            "Structured homepage classification for onboarding analysis with archetype, categories, buyer language, personas, pricing, and page patterns.",
          name: "onboarding_homepage_classification",
          schema: onboardingGatewayHomepageClassificationSchema,
        }),
        prompt: [
          `Website: ${input.website}`,
          `Company: ${input.companyName}`,
          `Mapped URLs: ${input.mappedPages
            .slice(0, 80)
            .map((page) => page.url)
            .join(", ")}`,
          "",
          `Homepage markdown:\n${input.homepage.markdown.slice(0, 12000)}`,
        ].join("\n"),
        system: buildGatewayStructuredOutputSystemPrompt([
          "You classify websites for onboarding analysis.",
          "Infer the site archetype, categories, pricing model, personas, buyer language, and page-equivalent patterns.",
          "Use homepage evidence first and mapped URLs second.",
          "Prefer observable evidence such as hero copy, navigation labels, pricing language, CTA phrasing, and repeated product taxonomy.",
          "Use empty arrays when buyer language, personas, or secondary categories are not clearly supported.",
          "Use an empty string for primarySubcategory when the homepage does not support a tighter label.",
          "Return only the schema fields.",
        ]),
        temperature: 0,
      })

      homepageClassification =
        onboardingHomepageClassificationSchema.parse(output)
    }
  } catch (error) {
    warnings = uniqueWarnings([
      ...warnings,
      toErrorWarning(
        "We could not fully classify the homepage, so we used a deterministic fallback.",
        error
      ),
    ])
    logStepError("Workflow homepage classification failed", error, {
      analysisId: input.analysisId,
      website: input.website,
    })
  }

  await persistRunPhase({
    analysisId: input.analysisId,
    authToken: input.authToken,
    status: "classifying",
    warnings,
  })

  return {
    ...input,
    homepageClassification,
    timings: extendTimings(input.timings, "classifyHomepageMs", startedAt),
    warnings,
  }
}
