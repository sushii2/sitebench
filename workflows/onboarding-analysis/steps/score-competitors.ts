import {
  extendTimings,
  persistRunPhase,
  scoreOverlap,
  tokenize,
} from "@/workflows/onboarding-analysis/steps/shared"
import type {
  CompetitorState,
} from "@/workflows/onboarding-analysis/types"

function scoreCompetitor(
  brandTokens: string[],
  buyerTokens: string[],
  pricingTokens: string[],
  geographyTokens: string[],
  competitor: CompetitorState["competitors"][number]
) {
  const competitorTokens = tokenize(
    `${competitor.name} ${competitor.website}`
  )
  const categoryOverlap = scoreOverlap(
    brandTokens,
    competitorTokens
  )
  const keywordOverlap = scoreOverlap(
    brandTokens,
    competitorTokens
  )
  const buyerOverlap = scoreOverlap(
    buyerTokens,
    competitorTokens
  )
  const pricingSimilarity = scoreOverlap(
    pricingTokens,
    competitorTokens
  )
  const geoSimilarity = scoreOverlap(
    geographyTokens,
    competitorTokens
  )
  const totalScore =
    categoryOverlap * 0.35 +
    keywordOverlap * 0.3 +
    buyerOverlap * 0.2 +
    pricingSimilarity * 0.1 +
    geoSimilarity * 0.05

  return {
    ...competitor,
    totalScore,
  }
}

export async function scoreCompetitorsStep(
  input: CompetitorState
): Promise<CompetitorState> {
  "use step"

  const startedAt = Date.now()
  const brandTokens = tokenize(
    [
      input.brandProfile.primaryCategory,
      input.brandProfile.primarySubcategory,
      ...input.brandProfile.categories,
      ...input.brandProfile.keywords,
      ...input.brandProfile.products,
    ].join(" ")
  )
  const buyerTokens = tokenize(input.brandProfile.targetCustomers.join(" "))
  const pricingTokens = tokenize(input.brandProfile.pricing)
  const geographyTokens = tokenize(input.brandProfile.geography ?? "")
  const competitors = input.competitors
    .map((competitor) =>
      scoreCompetitor(
        brandTokens,
        buyerTokens,
        pricingTokens,
        geographyTokens,
        competitor
      )
    )
    .sort((left, right) => right.totalScore - left.totalScore)
    .slice(0, 10)
    .map((scoredCompetitor) => {
      const { totalScore, ...competitor } = scoredCompetitor

      void totalScore

      return competitor
    })

  await persistRunPhase({
    analysisId: input.analysisId,
    authToken: input.authToken,
    status: "competitors",
    warnings: input.warnings,
  })

  return {
    ...input,
    competitors,
    timings: extendTimings(input.timings, "scoreCompetitorsMs", startedAt),
  }
}
