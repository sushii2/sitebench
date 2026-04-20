import { generateText } from "ai"

import {
  buildGatewayStructuredOutputSystemPrompt,
  createGatewayStructuredObjectOutput,
} from "@/lib/ai/gateway-structured-output"
import {
  getOnboardingStructuredOutputModel,
  ONBOARDING_STRUCTURED_OUTPUT_PROVIDER_OPTIONS,
} from "@/lib/onboarding/ai-config"
import {
  onboardingCriticalPageSelectionSchema,
  onboardingGatewayCriticalPageSelectionSchema,
} from "@/lib/onboarding/types"

import {
  extendTimings,
  logStepError,
  persistRunPhase,
  toErrorWarning,
  uniqueWarnings,
} from "@/workflows/onboarding-analysis/steps/shared"
import type {
  PrefilteredState,
  SelectedCriticalPage,
  SelectedState,
} from "@/workflows/onboarding-analysis/types"

function buildFallbackSelection(input: PrefilteredState): SelectedCriticalPage[] {
  return input.prefilteredPages.slice(0, 10).map((page, index) => ({
    candidateScore: page.candidateScore,
    description: page.description ?? null,
    expectedSignals: [page.candidateBucket, page.candidateReason],
    pageRole: page.pageRole,
    priority: index + 1,
    title: page.title ?? null,
    url: page.url,
    whySelected: page.candidateReason,
  }))
}

export async function selectCriticalPagesStep(
  input: PrefilteredState
): Promise<SelectedState> {
  "use step"

  const startedAt = Date.now()
  let warnings = [...input.warnings]
  let selectedPages = buildFallbackSelection(input)

  try {
    const { output } = await generateText({
      model: getOnboardingStructuredOutputModel(),
      output: createGatewayStructuredObjectOutput({
        description:
          "Structured critical-page selection for onboarding analysis with page roles, priorities, reasons, and expected signals.",
        name: "onboarding_critical_page_selection",
        schema: onboardingGatewayCriticalPageSelectionSchema,
      }),
      prompt: [
        `Website: ${input.website}`,
        `Company: ${input.companyName}`,
        `Archetype: ${input.homepageClassification.siteArchetype}`,
        `Primary category: ${input.homepageClassification.primaryCategory}`,
        `Primary subcategory: ${input.homepageClassification.primarySubcategory}`,
        "",
        "Prefiltered candidates:",
        ...input.prefilteredPages.slice(0, 120).map(
          (page, index) =>
            `${index + 1}. ${page.url}\nRole: ${page.pageRole}\nBucket: ${page.candidateBucket}\nReason: ${page.candidateReason}\nScore: ${page.candidateScore}`
        ),
      ].join("\n"),
      system: buildGatewayStructuredOutputSystemPrompt([
        "Select the smallest set of pages that best explains what the brand sells, who it sells to, how it prices, and how buyers evaluate alternatives.",
        "Do not look only for literal /product pages.",
        "For SaaS and enterprise software, treat platform, solutions, features, capabilities, industries, teams, and integrations pages as product-context pages.",
        "For ecommerce, treat category, collection, and merchandising hub pages like men, women, shoes, sale, and new arrivals as core commercial context.",
        "Prefer hub pages over deep-detail pages when many near-duplicate product pages exist.",
        "Do not waste slots on utility pages like login, cart, account, legal, or support unless the homepage classification indicates they are core to the business model.",
        "expectedSignals must describe the evidence you expect to extract from each chosen page, such as taxonomy breadth, pricing mechanics, product packaging, buyer segmentation, proof, or competitor framing.",
        "Return only the schema fields.",
      ]),
      providerOptions: ONBOARDING_STRUCTURED_OUTPUT_PROVIDER_OPTIONS,
      temperature: 0,
    })

    const parsed = onboardingCriticalPageSelectionSchema.parse(output)

    selectedPages = parsed.pages.map((page, index) => {
      const candidate =
        input.prefilteredPages.find((candidate) => candidate.url === page.url) ??
        input.prefilteredPages[index]

      return {
        candidateScore: candidate?.candidateScore ?? 0,
        description: candidate?.description ?? null,
        expectedSignals: page.expectedSignals,
        pageRole: page.pageRole,
        priority: page.priority,
        title: candidate?.title ?? null,
        url: page.url,
        whySelected: page.whySelected,
      }
    })
  } catch (error) {
    warnings = uniqueWarnings([
      ...warnings,
      toErrorWarning(
        "We could not fully rank critical pages, so we used the deterministic prefilter.",
        error
      ),
    ])
    logStepError("Workflow critical-page selection failed", error, {
      analysisId: input.analysisId,
      website: input.website,
    })
  }

  await persistRunPhase({
    analysisId: input.analysisId,
    authToken: input.authToken,
    selectedUrlCount: selectedPages.length,
    status: "planning",
    warnings,
  })

  return {
    ...input,
    selectedPages,
    timings: extendTimings(input.timings, "selectCriticalPagesMs", startedAt),
    warnings,
  }
}
