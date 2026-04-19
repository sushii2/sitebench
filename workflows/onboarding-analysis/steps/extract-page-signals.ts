import { generateText } from "ai"

import {
  buildGatewayStructuredOutputSystemPrompt,
  createGatewayStructuredObjectOutput,
} from "@/lib/ai/gateway-structured-output"
import { getLanguageModel } from "@/lib/ai/provider-config"
import {
  onboardingPageSignalBatchSchema,
  onboardingGatewayPageSignalBatchSchema,
} from "@/lib/onboarding/types"
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
  ScrapedState,
  SignalState,
} from "@/workflows/onboarding-analysis/types"

function buildFallbackPageSignals(
  input: ScrapedState
): SignalState["pageSignals"] {
  return input.scrapedPages.map((page) => ({
    competitorCandidates: [],
    confidence: 0.35,
    entities: uniqueWarnings([
      ...page.expectedSignals,
      ...(page.title ?? "")
        .split(/[^A-Za-z0-9]+/)
        .map((token) => token.trim())
        .filter((token) => token.length >= 4),
    ]).slice(0, 8),
    evidenceSnippets: uniqueWarnings(
      stripMarkdown(page.markdown)
        .split(/[.!?]/)
        .map((snippet) => snippet.trim())
        .filter((snippet) => snippet.length >= 20)
    ).slice(0, 3),
    intents: uniqueWarnings(page.expectedSignals).slice(0, 5),
    pageType: page.pageRole,
    url: page.url,
  }))
}

export async function extractPageSignalsStep(
  input: ScrapedState
): Promise<SignalState> {
  "use step"

  const startedAt = Date.now()
  let warnings = [...input.warnings]
  let pageSignals: SignalState["pageSignals"] = buildFallbackPageSignals(input)

  try {
    if (input.scrapedPages.length > 0) {
      const { output } = await generateText({
        model: getLanguageModel("openai", {
          capability: "structuredOutput",
          modelId: "openai/gpt-5.4-mini",
        }),
        output: createGatewayStructuredObjectOutput({
          description:
            "Structured page-level entities, intents, competitor candidates, and evidence snippets extracted from scraped onboarding pages.",
          name: "onboarding_page_signals",
          schema: onboardingGatewayPageSignalBatchSchema,
        }),
        prompt: input.scrapedPages
          .map(
            (page) =>
              [
                `URL: ${page.url}`,
                `Page role: ${page.pageRole}`,
                `Expected signals: ${page.expectedSignals.join(", ") || "(none)"}`,
                `Title: ${page.title ?? "(untitled)"}`,
                `Content: ${page.markdown.slice(0, 5000)}`,
              ].join("\n")
          )
          .join("\n\n"),
        system: buildGatewayStructuredOutputSystemPrompt([
          "Extract the strongest page-level brand and competitor signals from the supplied scraped pages.",
          "Return per-page entities, buyer intents, competitor candidates, evidence snippets, and confidence.",
          "Prefer direct competitor mentions from comparison pages, alternatives pages, integrations, pricing context, and product copy.",
          "Only return competitor candidates when the page evidence supports them.",
          "Return only the schema fields.",
        ]),
        temperature: 0,
      })

      const parsed = onboardingPageSignalBatchSchema.parse(output)
      const pageSignalByUrl = new Map(parsed.pages.map((page) => [page.url, page]))

      pageSignals = input.scrapedPages.map((page) => {
        const extracted = pageSignalByUrl.get(page.url)

        return (
          extracted ?? {
            competitorCandidates: [],
            confidence: 0.35,
            entities: page.expectedSignals,
            evidenceSnippets: [],
            intents: page.expectedSignals,
            pageType: page.pageRole,
            url: page.url,
          }
        )
      })
    }
  } catch (error) {
    warnings = uniqueWarnings([
      ...warnings,
      toErrorWarning(
        "We could not fully extract page signals, so the analysis used a lighter fallback.",
        error
      ),
    ])
    logStepError("Workflow page-signal extraction failed", error, {
      analysisId: input.analysisId,
      website: input.website,
    })
  }

  const client = createWorkflowOnboardingClient(input.authToken)
  const pageSignalByUrl = new Map(pageSignals.map((page) => [page.url, page]))
  await replaceSiteCrawlPages(
    client,
    input.analysisId,
    input.projectId,
    input.scrapedPages.map((page) => {
      const signal = pageSignalByUrl.get(page.url)

      return {
        canonical_url: page.url,
        competitor_candidates_json: {
          competitors: signal?.competitorCandidates ?? [],
        },
        content_snapshot: stripMarkdown(page.markdown).slice(0, 2000),
        entities_json: {
          confidence: signal?.confidence ?? 0,
          entities: signal?.entities ?? [],
          evidenceSnippets: signal?.evidenceSnippets ?? [],
        },
        intents_json: {
          confidence: signal?.confidence ?? 0,
          intents: signal?.intents ?? [],
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
      }
    })
  )

  await persistRunPhase({
    analysisId: input.analysisId,
    authToken: input.authToken,
    selectedUrlCount: input.scrapedPages.length,
    status: "scraping",
    warnings,
  })

  return {
    ...input,
    pageSignals,
    timings: extendTimings(input.timings, "extractPageSignalsMs", startedAt),
    warnings,
  }
}
