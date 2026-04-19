import {
  classifyMappedPage,
  mergeMappedPages,
  type MappedPageCandidate,
} from "@/lib/onboarding/analysis-selection"
import { mapWebsiteUrls } from "@/lib/onboarding/firecrawl"
import { replaceSiteCrawlMappedPages } from "@/lib/site-crawl-mapped-pages/repository"

import {
  createWorkflowOnboardingClient,
  extendTimings,
  logStepError,
  persistRunPhase,
  toErrorWarning,
  uniqueWarnings,
} from "@/workflows/onboarding-analysis/steps/shared"
import type {
  MappedState,
  WorkflowState,
} from "@/workflows/onboarding-analysis/types"

export async function mapWebsiteStep(input: WorkflowState): Promise<MappedState> {
  "use step"

  const startedAt = Date.now()
  let mappedPages: MappedPageCandidate[] = [
    {
      description: input.companyName,
      title: input.companyName,
      url: input.website,
    },
  ]
  let warnings = [...input.warnings]

  try {
    const result = await mapWebsiteUrls(input.website, {
      limit: 500,
    })

    mappedPages = mergeMappedPages([result])
  } catch (error) {
    warnings = uniqueWarnings([
      ...warnings,
      toErrorWarning("We could not map the full website.", error),
    ])
    logStepError("Workflow map step failed", error, {
      analysisId: input.analysisId,
      website: input.website,
    })
  }

  const client = createWorkflowOnboardingClient(input.authToken)
  const classifiedPages = mappedPages.map((page) =>
    classifyMappedPage(page, {
      rootUrl: input.website,
      siteArchetype: "saas",
    })
  )

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
    status: "mapping",
    warnings,
  })

  return {
    ...input,
    mappedPages,
    timings: extendTimings(input.timings, "mapWebsiteMs", startedAt),
    warnings,
  }
}
