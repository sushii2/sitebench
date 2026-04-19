import { batchScrapePages } from "@/lib/onboarding/firecrawl"
import { replaceSiteCrawlPages } from "@/lib/site-crawl-pages/repository"

import {
  createWorkflowOnboardingClient,
  extendTimings,
  logStepError,
  persistRunPhase,
  stripMarkdown,
  toErrorWarning,
  uniqueWarnings,
} from "@/workflows/onboarding-analysis/steps/shared"
import type {
  ScrapedSelectedPage,
  ScrapedState,
  SelectedState,
} from "@/workflows/onboarding-analysis/types"

function createSyntheticHomepagePage(input: SelectedState) {
  const homepageSelection = input.selectedPages.find(
    (page) => page.pageRole === "homepage"
  )

  if (!homepageSelection || !input.homepage) {
    return null
  }

  return {
    description: homepageSelection.description ?? null,
    expectedSignals: homepageSelection.expectedSignals,
    html: input.homepage.html,
    markdown: input.homepage.markdown,
    metaDescription: homepageSelection.description ?? null,
    pageRole: homepageSelection.pageRole,
    priority: homepageSelection.priority,
    title: homepageSelection.title ?? input.companyName,
    url: homepageSelection.url,
    whySelected: homepageSelection.whySelected,
  } satisfies ScrapedSelectedPage
}

export async function scrapeSelectedPagesStep(
  input: SelectedState
): Promise<ScrapedState> {
  "use step"

  const startedAt = Date.now()
  let warnings = [...input.warnings]
  let scrapedPages: ScrapedSelectedPage[] = []

  try {
    const documents = await batchScrapePages(
      input.selectedPages.map((page) => page.url)
    )
    const syntheticHomepagePage = createSyntheticHomepagePage(input)
    const documentByUrl = new Map(documents.map((document) => [document.url, document]))

    scrapedPages = input.selectedPages.flatMap((page) => {
      const document = documentByUrl.get(page.url)

      if (document) {
        return [
          {
            description: page.description ?? null,
            expectedSignals: page.expectedSignals,
            html: document.html,
            markdown: document.markdown,
            metaDescription:
              typeof document.metadata.description === "string"
                ? document.metadata.description
                : page.description ?? null,
            pageRole: page.pageRole,
            priority: page.priority,
            title:
              typeof document.metadata.title === "string"
                ? document.metadata.title
                : page.title ?? null,
            url: document.url,
            whySelected: page.whySelected,
          },
        ]
      }

      if (syntheticHomepagePage && syntheticHomepagePage.url === page.url) {
        return [syntheticHomepagePage]
      }

      return []
    })

    if (scrapedPages.length < input.selectedPages.length) {
      warnings = uniqueWarnings([
        ...warnings,
        "Some selected pages could not be scraped, so the analysis continued with the pages that succeeded.",
      ])
    }
  } catch (error) {
    warnings = uniqueWarnings([
      ...warnings,
      toErrorWarning(
        "We could not scrape every selected page, so the analysis used a partial fallback.",
        error
      ),
    ])
    logStepError("Workflow selected-page scrape failed", error, {
      analysisId: input.analysisId,
      website: input.website,
    })

    const syntheticHomepagePage = createSyntheticHomepagePage(input)
    scrapedPages = syntheticHomepagePage ? [syntheticHomepagePage] : []
  }

  const client = createWorkflowOnboardingClient(input.authToken)
  await replaceSiteCrawlPages(
    client,
    input.analysisId,
    input.projectId,
    scrapedPages.map((page) => ({
      canonical_url: page.url,
      competitor_candidates_json: {},
      content_snapshot: stripMarkdown(page.markdown).slice(0, 2000),
      entities_json: {
        expectedSignals: page.expectedSignals,
      },
      intents_json: {
        expectedSignals: page.expectedSignals,
      },
      meta_description: page.metaDescription ?? null,
      page_metadata_json: {
        priority: page.priority,
        whySelected: page.whySelected,
      },
      page_type: page.pageRole,
      selection_reason: page.whySelected,
      selection_score: Math.max(100 - page.priority * 5, 1),
      title: page.title ?? null,
    }))
  )

  await persistRunPhase({
    analysisId: input.analysisId,
    authToken: input.authToken,
    selectedUrlCount: scrapedPages.length,
    status: "scraping",
    warnings,
  })

  return {
    ...input,
    scrapedPages,
    timings: extendTimings(input.timings, "scrapeSelectedPagesMs", startedAt),
    warnings,
  }
}
