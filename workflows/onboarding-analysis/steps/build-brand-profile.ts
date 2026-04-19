import { generateText } from "ai"

import {
  buildGatewayStructuredOutputSystemPrompt,
  createGatewayStructuredObjectOutput,
} from "@/lib/ai/gateway-structured-output"
import { getLanguageModel } from "@/lib/ai/provider-config"
import {
  onboardingBrandProfileSchema,
  onboardingGatewayBrandProfileSchema,
} from "@/lib/onboarding/types"

import {
  extendTimings,
  logStepError,
  normalizeWhitespace,
  persistRunPhase,
  stripMarkdown,
  toErrorWarning,
  uniqueWarnings,
} from "@/workflows/onboarding-analysis/steps/shared"
import type {
  ProfiledState,
  ScrapedState,
} from "@/workflows/onboarding-analysis/types"

function buildFallbackBrandProfile(input: ScrapedState) {
  const keywordPool = uniqueWarnings(
    input.scrapedPages.flatMap((page) =>
      page.url
        .split("/")
        .flatMap((segment) => segment.split(/[-_]/))
        .map((segment) => segment.trim())
        .filter((segment) => segment.length >= 4)
    )
  ).slice(0, 10)
  const productLabels = uniqueWarnings(
    input.selectedPages.flatMap((page) =>
      [page.title ?? "", page.description ?? ""].filter(Boolean)
    )
  ).slice(0, 6)
  const detailedDescription =
    stripMarkdown(input.homepage?.markdown ?? "").slice(0, 320) ||
    `${input.companyName} appears to serve ${input.homepageClassification.primaryCategory} buyers.`

  return onboardingBrandProfileSchema.parse({
    careers: input.classifiedPages.some((page) => page.pageRole === "careers_page")
      ? "Careers page present in the mapped site."
      : null,
    categories: uniqueWarnings([
      input.homepageClassification.primaryCategory,
      ...input.homepageClassification.secondaryCategories,
      ...input.homepageClassification.categories,
    ]),
    detailedDescription: normalizeWhitespace(detailedDescription),
    geography: null,
    jobsToBeDone: uniqueWarnings([
      ...input.homepageClassification.personas.map(
        (persona) => `help ${persona} evaluate options`
      ),
      ...productLabels.slice(0, 3),
    ]),
    keywords: keywordPool,
    pricing: input.homepageClassification.pricingModel,
    primaryCategory: input.homepageClassification.primaryCategory,
    primarySubcategory: input.homepageClassification.primarySubcategory,
    products: productLabels,
    siteArchetype: input.homepageClassification.siteArchetype,
    targetCustomers: input.homepageClassification.personas,
    warnings: input.warnings,
  })
}

export async function buildBrandProfileStep(
  input: ScrapedState
): Promise<ProfiledState> {
  "use step"

  const startedAt = Date.now()
  let warnings = [...input.warnings]
  let brandProfile = buildFallbackBrandProfile(input)

  try {
    if (input.scrapedPages.length > 0) {
      const { output } = await generateText({
        model: getLanguageModel("openai", {
          capability: "structuredOutput",
        }),
        output: createGatewayStructuredObjectOutput({
          description:
            "Structured brand profile synthesis for onboarding analysis including category, customers, jobs, products, pricing, geography, careers, and warnings.",
          name: "onboarding_brand_profile",
          schema: onboardingGatewayBrandProfileSchema,
        }),
        prompt: [
          `Website: ${input.website}`,
          `Company: ${input.companyName}`,
          `Archetype: ${input.homepageClassification.siteArchetype}`,
          `Primary category: ${input.homepageClassification.primaryCategory}`,
          "",
          ...input.scrapedPages.map(
            (page) =>
              `URL: ${page.url}\nRole: ${page.pageRole}\nWhy: ${page.whySelected}\nContent:\n${page.markdown.slice(0, 5000)}`
          ),
        ].join("\n\n"),
        system: buildGatewayStructuredOutputSystemPrompt([
          "Synthesize a structured brand profile grounded in the supplied homepage classification and page evidence.",
          "Infer categories, target customers, keywords, jobs to be done, pricing, products, geography, and careers signals.",
          "Only include geography or careers when the evidence is explicit; otherwise return null for those fields.",
          "primarySubcategory should be more specific than primaryCategory when the evidence clearly supports it, otherwise use an empty string.",
          "warnings should stay empty unless the evidence itself creates a meaningful brand-profile caveat.",
          "Return only the schema fields.",
        ]),
        temperature: 0,
      })

      brandProfile = onboardingBrandProfileSchema.parse(output)
    }
  } catch (error) {
    warnings = uniqueWarnings([
      ...warnings,
      toErrorWarning(
        "We could not fully synthesize the brand profile, so we used a deterministic fallback.",
        error
      ),
    ])
    logStepError("Workflow brand-profile synthesis failed", error, {
      analysisId: input.analysisId,
      website: input.website,
    })
    brandProfile = {
      ...brandProfile,
      warnings,
    }
  }

  await persistRunPhase({
    analysisId: input.analysisId,
    authToken: input.authToken,
    status: "profiling",
    warnings,
  })

  return {
    ...input,
    brandProfile: {
      ...brandProfile,
      warnings: uniqueWarnings([
        ...brandProfile.warnings,
        ...warnings,
      ]),
    },
    timings: extendTimings(input.timings, "buildBrandProfileMs", startedAt),
    warnings,
  }
}
