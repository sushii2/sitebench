import {
  classifyMappedPage,
  prefilterMappedPages,
} from "@/lib/onboarding/analysis-selection"
import { replaceSiteCrawlMappedPages } from "@/lib/site-crawl-mapped-pages/repository"

import {
  createWorkflowOnboardingClient,
  extendTimings,
  persistRunPhase,
  uniqueWarnings,
} from "@/workflows/onboarding-analysis/steps/shared"
import type {
  ClassifiedState,
  PrefilteredState,
} from "@/workflows/onboarding-analysis/types"

export async function prefilterMappedPagesStep(
  input: ClassifiedState
): Promise<PrefilteredState> {
  "use step"

  const startedAt = Date.now()
  const classifiedPages = input.mappedPages.map((page) =>
    classifyMappedPage(page, {
      classification: input.homepageClassification,
      rootUrl: input.website,
      siteArchetype: input.homepageClassification.siteArchetype,
    })
  )
  const prefilteredPages = prefilterMappedPages(input.mappedPages, {
    classification: input.homepageClassification,
    homepageUrl: input.website,
    limit: 120,
    siteArchetype: input.homepageClassification.siteArchetype,
  })
  const warnings = uniqueWarnings(input.warnings)

  const client = createWorkflowOnboardingClient(input.authToken)
  await replaceSiteCrawlMappedPages(
    client,
    input.analysisId,
    input.projectId,
    classifiedPages.map((page) => ({
      candidate_bucket: page.candidateBucket,
      candidate_reason: page.candidateReason,
      candidate_score: page.candidateScore,
      canonical_url: page.url,
      meta_description: page.description ?? null,
      title: page.title ?? null,
    }))
  )

  await persistRunPhase({
    analysisId: input.analysisId,
    authToken: input.authToken,
    status: "planning",
    warnings,
  })

  return {
    ...input,
    classifiedPages,
    prefilteredPages,
    timings: extendTimings(input.timings, "prefilterMappedPagesMs", startedAt),
    warnings,
  }
}
