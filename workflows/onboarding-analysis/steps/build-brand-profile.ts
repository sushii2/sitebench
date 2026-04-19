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
  SignalState,
} from "@/workflows/onboarding-analysis/types"

function buildFallbackBrandProfile(input: SignalState) {
  const keywordPool = uniqueWarnings(
    input.pageSignals.flatMap((page) => [...page.entities, ...page.intents])
  ).slice(0, 10)
  const productLabels = uniqueWarnings(
    input.selectedPages.flatMap((page) =>
      [page.title ?? "", page.description ?? ""].filter(Boolean)
    )
  ).slice(0, 6)
  const evidenceUrls = input.pageSignals.map((page) => page.url).slice(0, 10)
  const competitorNames = uniqueWarnings(
    input.pageSignals.flatMap((page) =>
      page.competitorCandidates.map((competitor) => competitor.name)
    )
  )
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
    comparisonSets: competitorNames.map(
      (competitorName) => `${input.companyName} vs ${competitorName}`
    ),
    conversionMoments: uniqueWarnings(
      input.pageSignals.flatMap((page) =>
        page.intents.filter((intent) =>
          /\b(buy|book|demo|quote|trial|pricing)\b/i.test(intent)
        )
      )
    ),
    detailedDescription: normalizeWhitespace(detailedDescription),
    differentiators: uniqueWarnings(
      input.pageSignals.flatMap((page) => page.entities)
    ).slice(0, 8),
    evidenceUrls,
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
    reputationalQuestions: [
      `Is ${input.companyName} worth considering for ${input.homepageClassification.primaryCategory}?`,
    ],
    researchJourneys: uniqueWarnings(
      input.pageSignals.flatMap((page) => page.intents)
    ).slice(0, 8),
    secondaryCategories: input.homepageClassification.secondaryCategories,
    siteArchetype: input.homepageClassification.siteArchetype,
    targetAudiences: input.homepageClassification.personas,
    targetCustomers: input.homepageClassification.personas,
    warnings: input.warnings,
  })
}

export async function buildBrandProfileStep(
  input: SignalState
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
              `URL: ${page.url}\nRole: ${page.pageRole}\nWhy: ${page.whySelected}\nSignals: ${
                input.pageSignals
                  .find((signal) => signal.url === page.url)
                  ?.entities.join(", ") || "(none)"
              }\nIntents: ${
                input.pageSignals
                  .find((signal) => signal.url === page.url)
                  ?.intents.join(", ") || "(none)"
              }\nContent:\n${page.markdown.slice(0, 5000)}`
          ),
        ].join("\n\n"),
        system: buildGatewayStructuredOutputSystemPrompt([
          "Synthesize a structured brand profile grounded in the supplied homepage classification, page evidence, and extracted page signals.",
          "Infer categories, target customers, keywords, jobs to be done, pricing, products, geography, careers, research journeys, comparison sets, differentiators, and conversion moments.",
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
