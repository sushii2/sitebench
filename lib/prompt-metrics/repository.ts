import type { InsForgeClient } from "@insforge/sdk"

import type { BrandRole } from "@/lib/brand-entities/types"
import type { PromptRunResponseStatus } from "@/lib/prompt-run-responses/types"
import type { SentimentLabel } from "@/lib/response-brand-metrics/types"

type PromptMetricsClient = Pick<InsForgeClient, "database">

type MaybeOne<T> = T | T[] | null | undefined

type RawBrandMetric = {
  brand_entities: MaybeOne<{ id: string; role: BrandRole }>
  rank_position: number | null
  sentiment_label: SentimentLabel
  sentiment_score: number | null
  visibility_score: number
}

type RawResponse = {
  platform_code: string
  responded_at: string | null
  response_brand_metrics: RawBrandMetric[] | null
  status: PromptRunResponseStatus
}

export type PromptMetricRun = {
  completed_at: string | null
  prompt_run_responses: RawResponse[] | null
  scheduled_for: string
  tracked_prompt_id: string
}

export type PromptMetricSummary = {
  performerCount: number
  ranAt: string | null
  sentiment: SentimentLabel | null
  trackedPromptId: string
  visibility: number | null
}

function takeRows<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

function firstOf<T>(value: MaybeOne<T>): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

function compareRunsDescending(a: PromptMetricRun, b: PromptMetricRun) {
  return (
    Date.parse(b.scheduled_for) - Date.parse(a.scheduled_for) ||
    Date.parse(b.completed_at ?? "") - Date.parse(a.completed_at ?? "")
  )
}

function countTopPerformers(
  metrics: RawBrandMetric[],
  primaryMetric: RawBrandMetric | null
): number {
  if (!primaryMetric) {
    return 0
  }

  return metrics.filter((metric) => {
    const brand = firstOf(metric.brand_entities)

    if (!brand || brand.role !== "competitor") {
      return false
    }

    if (
      primaryMetric.rank_position !== null &&
      metric.rank_position !== null
    ) {
      return metric.rank_position < primaryMetric.rank_position
    }

    return metric.visibility_score > primaryMetric.visibility_score
  }).length
}

export function mapPromptMetricRuns(
  runs: PromptMetricRun[],
  platformCode: string
): PromptMetricSummary[] {
  const summaries = new Map<string, PromptMetricSummary>()

  for (const run of [...runs].sort(compareRunsDescending)) {
    if (summaries.has(run.tracked_prompt_id)) {
      continue
    }

    const response = (run.prompt_run_responses ?? []).find(
      (candidate) => candidate.platform_code === platformCode
    )

    if (!response) {
      continue
    }

    const metrics = response.response_brand_metrics ?? []
    const primaryMetric =
      metrics.find((metric) => firstOf(metric.brand_entities)?.role === "primary") ??
      null

    summaries.set(run.tracked_prompt_id, {
      performerCount: countTopPerformers(metrics, primaryMetric),
      ranAt: response.responded_at ?? run.completed_at ?? run.scheduled_for,
      sentiment: primaryMetric?.sentiment_label ?? null,
      trackedPromptId: run.tracked_prompt_id,
      visibility: primaryMetric?.visibility_score ?? null,
    })
  }

  return [...summaries.values()]
}

const SELECT = `tracked_prompt_id,scheduled_for,completed_at,
  prompt_run_responses(
    platform_code,
    responded_at,
    status,
    response_brand_metrics(
      rank_position,
      sentiment_label,
      sentiment_score,
      visibility_score,
      brand_entities(id, role)
    )
  )`

export async function loadPromptMetrics(
  client: PromptMetricsClient,
  input: {
    platformCode: string
    projectId: string
  }
): Promise<Map<string, PromptMetricSummary>> {
  const response = await client.database
    .from("prompt_runs")
    .select(SELECT)
    .eq("project_id", input.projectId)
    .order("scheduled_for", { ascending: false })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load prompt metrics.")
  }

  const rows = takeRows(response.data as PromptMetricRun[] | PromptMetricRun | null)

  return new Map(
    mapPromptMetricRuns(rows, input.platformCode).map((summary) => [
      summary.trackedPromptId,
      summary,
    ])
  )
}
