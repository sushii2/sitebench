import { generateText, stepCountIs } from "ai"
import { logger, task } from "@trigger.dev/sdk"

import { createGatewayStructuredObjectOutput } from "@/lib/ai/gateway-structured-output"
import {
  computeShareOfVoice,
  normalizeCitation,
} from "@/lib/prompt-runs/analysis"
import { promptRunAnalysisOutputSchema } from "@/lib/prompt-runs/extraction-schema"
import type { BrandEntity } from "@/lib/brand-entities/types"
import { getPromptRunAnalysisModel } from "@/src/trigger/prompt-runs/ai-config"
import type {
  AnalyzeResponsesPayload,
  AnalyzedProviderExecutionResult,
  AnalyzedRunPayload,
  DiscoveredCompetitorCandidate,
  ProviderExecutionResult,
} from "@/src/trigger/prompt-runs/shared"
import {
  PROMPT_RUN_ANALYZER_VERSION,
  summarizePromptRunStatus,
  toPromptRunCadence,
} from "@/src/trigger/prompt-runs/shared"

function truncate(value: string | null, maxLength: number) {
  if (!value) {
    return ""
  }

  return value.length <= maxLength ? value : `${value.slice(0, maxLength)}...`
}

function countOccurrences(text: string, needle: string) {
  const normalizedNeedle = needle.trim().toLowerCase()

  if (!normalizedNeedle) {
    return 0
  }

  return text.split(normalizedNeedle).length - 1
}

function buildPromptAnalysisInput(payload: AnalyzeResponsesPayload) {
  return JSON.stringify(
    {
      analyzerVersion: PROMPT_RUN_ANALYZER_VERSION,
      brands: payload.brands.map((brand) => ({
        id: brand.id,
        name: brand.name,
        role: brand.role,
        website: brand.website_url,
      })),
      responses: payload.responses.map((response) => ({
        citations: response.citations,
        promptText: response.promptText,
        providerId: response.providerId,
        responseText: truncate(response.rawResponseText, 12_000),
        trackedPromptId: response.trackedPromptId,
      })),
    },
    null,
    2
  )
}

function createHeuristicMetrics(
  response: ProviderExecutionResult,
  brands: BrandEntity[]
): AnalyzedProviderExecutionResult["brandMetrics"] {
  const responseText = response.rawResponseText?.toLowerCase() ?? ""
  const mentionCounts = brands.map((brand) => ({
    brandEntityId: brand.id,
    mentionCount: countOccurrences(responseText, brand.name.toLowerCase()),
  }))
  const totalMentions = mentionCounts.reduce(
    (sum, brand) => sum + brand.mentionCount,
    0
  )

  return mentionCounts.map((mention, index) => ({
    brandEntityId: mention.brandEntityId,
    citationScore:
      mention.mentionCount > 0 ? Math.min(100, response.citations.length * 20) : 0,
    citationUrls:
      mention.mentionCount > 0 ? response.citations.map((citation) => citation.url) : [],
    mentionCount: mention.mentionCount,
    rankPosition: mention.mentionCount > 0 ? index + 1 : null,
    recommendationStatus:
      mention.mentionCount > 0 ? "mentioned" : "not_recommended",
    sentimentLabel: "neutral",
    sentimentScore: mention.mentionCount > 0 ? 0 : null,
    visibilityScore: computeShareOfVoice(mention.mentionCount, totalMentions),
  }))
}

function mergeMetrics(input: {
  brands: BrandEntity[]
  llmMetrics: Array<{
    brandEntityId: string
    citationScore: number
    citationUrls: string[]
    mentionCount: number
    rankPosition: number | null
    recommendationStatus: "recommended" | "mentioned" | "not_recommended"
    sentimentLabel: "positive" | "neutral" | "negative" | "mixed"
    sentimentScore: number | null
    visibilityScore: number
  }>
  response: ProviderExecutionResult
}) {
  const heuristicMetrics = createHeuristicMetrics(input.response, input.brands)
  const metricsByBrand = new Map(
    heuristicMetrics.map((metric) => [metric.brandEntityId, metric])
  )

  for (const metric of input.llmMetrics) {
    if (!metricsByBrand.has(metric.brandEntityId)) {
      continue
    }

    metricsByBrand.set(metric.brandEntityId, {
      ...metric,
      citationUrls: metric.citationUrls
        .map((url) => normalizeCitation(url))
        .filter((url): url is string => Boolean(url)),
    })
  }

  return [...metricsByBrand.values()]
}

function dedupeDiscoveredCompetitors(
  candidates: DiscoveredCompetitorCandidate[]
) {
  const seen = new Set<string>()

  return candidates.filter((candidate) => {
    const key = `${candidate.name.trim().toLowerCase()}|${candidate.websiteUrl
      .trim()
      .toLowerCase()}`

    if (seen.has(key)) {
      return false
    }

    seen.add(key)
    return true
  })
}

export const analyzeResponses = task({
  id: "prompt-runs.analyze-responses",
  maxDuration: 600,
  queue: {
    concurrencyLimit: 5,
    name: "prompt-runs-analysis",
  },
  retry: {
    factor: 2,
    maxAttempts: 2,
    maxTimeoutInMs: 15_000,
    minTimeoutInMs: 1_000,
    randomize: true,
  },
  run: async (payload: AnalyzeResponsesPayload): Promise<AnalyzedRunPayload> => {
    logger.info("[prompt-runs] Analyzer started", {
      brandCount: payload.brands.length,
      projectId: payload.projectId,
      responseCount: payload.responses.length,
    })

    const heuristicResponseMap = new Map(
      payload.responses.map((response) => [
        `${response.trackedPromptId}:${response.providerId}`,
        {
          brandMetrics: createHeuristicMetrics(response, payload.brands),
          responseSummary: truncate(response.rawResponseText, 280),
        },
      ])
    )

    let discoveredCompetitors: DiscoveredCompetitorCandidate[] = []
    let llmResponseMap = new Map<
      string,
      {
        brandMetrics: Array<{
          brandEntityId: string
          citationScore: number
          citationUrls: string[]
          mentionCount: number
          rankPosition: number | null
          recommendationStatus: "recommended" | "mentioned" | "not_recommended"
          sentimentLabel: "positive" | "neutral" | "negative" | "mixed"
          sentimentScore: number | null
          visibilityScore: number
        }>
        responseSummary: string
      }
    >()

    try {
      const result = await generateText({
        model: getPromptRunAnalysisModel(),
        onStepFinish({
          finishReason,
          stepNumber,
          toolCalls,
          toolResults,
          usage,
        }) {
          logger.info("[prompt-runs] Analyzer step finished", {
            finishReason,
            stepNumber,
            toolCallCount: toolCalls.length,
            toolResultCount: toolResults.length,
            usage,
          })
        },
        output: createGatewayStructuredObjectOutput({
          description:
            "Structured prompt-run analysis with brand metrics and discovered competitors.",
          name: "prompt_run_analysis",
          schema: promptRunAnalysisOutputSchema,
        }),
        prompt: buildPromptAnalysisInput(payload),
        providerOptions: {
          openai: {
            store: false,
            textVerbosity: "low",
          },
        },
        stopWhen: stepCountIs(3),
        system:
          "Analyze each response for the known brands. Return one response object per provider response. Only output discovered competitors when the response contains explicit evidence. Use citationUrls only when the URL is in the supplied citations. Return empty arrays instead of guesses.",
        temperature: 0,
      })

      const output = promptRunAnalysisOutputSchema.parse(result.output)

      discoveredCompetitors = dedupeDiscoveredCompetitors(
        output.discoveredCompetitors.map((candidate) => ({
          description: candidate.description,
          evidenceQuote: candidate.evidenceQuote,
          name: candidate.name,
          websiteUrl: candidate.websiteUrl,
        }))
      )

      llmResponseMap = new Map(
        output.responses.map((response) => [
          `${response.trackedPromptId}:${response.providerId}`,
          {
            brandMetrics: response.brandMetrics,
            responseSummary: response.responseSummary,
          },
        ])
      )
    } catch (error) {
      logger.warn("[prompt-runs] Analyzer fallback engaged", {
        error: error instanceof Error ? error.message : error,
        projectId: payload.projectId,
      })
    }

    const analyzedResponses = payload.responses.map((response) => {
      const key = `${response.trackedPromptId}:${response.providerId}`
      const heuristic = heuristicResponseMap.get(key)
      const llm = llmResponseMap.get(key)

      return {
        ...response,
        brandMetrics: mergeMetrics({
          brands: payload.brands,
          llmMetrics: llm?.brandMetrics ?? [],
          response,
        }),
        responseSummary: llm?.responseSummary ?? heuristic?.responseSummary ?? "",
      } satisfies AnalyzedProviderExecutionResult
    })

    const promptRuns = payload.trackedPrompts.map((trackedPrompt) => {
      const providerResults = analyzedResponses.filter(
        (response) => response.trackedPromptId === trackedPrompt.id
      )
      const statusSummary = summarizePromptRunStatus(providerResults)

      return {
        failureReason: statusSummary.failureReason,
        projectTopicId: trackedPrompt.project_topic_id,
        promptText: trackedPrompt.prompt_text,
        providerResults,
        status: statusSummary.status,
        trackedPromptId: trackedPrompt.id,
      }
    })

    logger.info("[prompt-runs] Analyzer completed", {
      discoveredCompetitorCount: discoveredCompetitors.length,
      promptRunCount: promptRuns.length,
      projectId: payload.projectId,
    })

    return {
      brands: payload.brands,
      cadenceApplied: toPromptRunCadence(
        payload.cadenceDays,
        payload.triggerType
      ),
      cadenceDays: payload.cadenceDays,
      completedAt: new Date().toISOString(),
      configId: payload.configId,
      discoveredCompetitors,
      projectId: payload.projectId,
      promptRuns,
      scheduledFor: payload.scheduledFor,
      startedAt: payload.startedAt,
      trackedPrompts: payload.trackedPrompts,
      triggerType: payload.triggerType,
    }
  },
})
