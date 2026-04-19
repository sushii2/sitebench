import { generateText } from "ai"

import {
  buildGatewayStructuredOutputSystemPrompt,
  createGatewayStructuredObjectOutput,
} from "@/lib/ai/gateway-structured-output"
import { getLanguageModel } from "@/lib/ai/provider-config"
import { onboardingCompetitorRecoverySchema } from "@/lib/onboarding/types"

import {
  extendTimings,
  logStepError,
  normalizeWhitespace,
  persistRunPhase,
  toErrorWarning,
  uniqueWarnings,
} from "@/workflows/onboarding-analysis/steps/shared"
import type {
  OnboardingCompetitor,
} from "@/lib/onboarding/types"
import type {
  CompetitorState,
  ProfiledState,
} from "@/workflows/onboarding-analysis/types"

function extractCompetitorsFromPages(input: ProfiledState): OnboardingCompetitor[] {
  const extractedSignals = input.pageSignals.flatMap(
    (page) => page.competitorCandidates
  )
  const matches = input.scrapedPages.flatMap((page) => {
    const title = `${page.title ?? ""} ${page.markdown.slice(0, 800)}`
    const candidates = [
      ...title.matchAll(/\bvs\.?\s+([A-Z][A-Za-z0-9&.\- ]{2,40})/g),
      ...title.matchAll(/\balternatives?\s+to\s+([A-Z][A-Za-z0-9&.\- ]{2,40})/g),
    ]

    return candidates.map((candidate) => normalizeWhitespace(candidate[1] ?? ""))
  })

  return dedupeCompetitors([
    ...extractedSignals,
    ...uniqueWarnings(matches)
      .filter(
        (name) => name.toLowerCase() !== input.companyName.trim().toLowerCase()
      )
      .slice(0, 12)
      .map((name) => ({
        name,
        website: `https://${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.com`,
      })),
  ])
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

export async function generateCompetitorCandidatesStep(
  input: ProfiledState
): Promise<CompetitorState> {
  "use step"

  const startedAt = Date.now()
  let warnings = [...input.warnings]
  let competitors = extractCompetitorsFromPages(input)

  try {
    const { output } = await generateText({
      model: getLanguageModel("openai", {
        capability: "structuredOutput",
      }),
      output: createGatewayStructuredObjectOutput({
        description:
          "Structured competitor candidate expansion for onboarding analysis.",
        name: "onboarding_competitor_candidates",
        schema: onboardingCompetitorRecoverySchema,
      }),
      prompt: [
        `Company: ${input.companyName}`,
        `Website: ${input.website}`,
        `Category: ${input.brandProfile.primaryCategory}`,
        `Description: ${input.brandProfile.detailedDescription}`,
        `Target customers: ${input.brandProfile.targetCustomers.join(", ")}`,
        `Keywords: ${input.brandProfile.keywords.join(", ")}`,
      ].join("\n"),
      system: buildGatewayStructuredOutputSystemPrompt([
        "Generate 12 to 15 likely competitors for the supplied brand profile.",
        "Prefer direct competitors that solve the same core problem for similar buyers.",
        "Prefer official competitor homepages and avoid marketplaces, agencies, consultancies, publishers, and implementation partners.",
        "Return fewer competitors rather than weak or speculative matches.",
        "Return only the schema fields.",
      ]),
      temperature: 0,
    })

    const generated = onboardingCompetitorRecoverySchema.parse(output).competitors

    if (generated.length > 0) {
      competitors = generated
    }
  } catch (error) {
    warnings = uniqueWarnings([
      ...warnings,
      toErrorWarning(
        "We could not fully expand competitor candidates, so we used on-site signals only.",
        error
      ),
    ])
    logStepError("Workflow competitor-candidate generation failed", error, {
      analysisId: input.analysisId,
      website: input.website,
    })
  }

  await persistRunPhase({
    analysisId: input.analysisId,
    authToken: input.authToken,
    status: "competitors",
    warnings,
  })

  return {
    ...input,
    competitors,
    timings: extendTimings(input.timings, "generateCompetitorsMs", startedAt),
    warnings,
  }
}
