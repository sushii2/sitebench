import type { BrandEntity } from "@/lib/brand-entities/types"
import type { PromptRunConfig, PromptRunCadenceDays } from "@/lib/prompt-run-configs/types"
import type { PromptRunResponseStatus } from "@/lib/prompt-run-responses/types"
import type {
  PromptRunCadence,
  PromptRunStatus,
  PromptRunTriggerType,
} from "@/lib/prompt-runs/types"
import type {
  RecommendationStatus,
  SentimentLabel,
} from "@/lib/response-brand-metrics/types"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

export const PROMPT_RUN_ANALYZER_VERSION = "2026-04-21"
export const PROMPT_RUN_RESPONSE_PARSER_VERSION = "2026-04-21"
export const PROMPT_RUN_CLAIM_WINDOW_MINUTES = 10

export const PROMPT_RUN_TERMINAL_FAILURE_STATUSES = new Set<string>([
  "FAILED",
  "CRASHED",
  "SYSTEM_FAILURE",
  "TIMED_OUT",
  "CANCELED",
  "EXPIRED",
])

export function isPromptRunStatusTerminallyFailed(status: string | null | undefined) {
  if (!status) {
    return false
  }

  return PROMPT_RUN_TERMINAL_FAILURE_STATUSES.has(status.toUpperCase())
}

export type ConfiguredPromptRunTriggerType = Extract<
  PromptRunTriggerType,
  "manual" | "scheduled"
>

export interface ExtractedCitation {
  url: string
  title: string | null
  citationOrder: number | null
  text: string | null
}

export interface ConfiguredPromptRunPayload {
  projectId: string
  triggerType: ConfiguredPromptRunTriggerType
}

export interface ProviderExecutionPayload {
  projectId: string
  projectTopicId: string
  providerId: "chatgpt" | "claude" | "perplexity"
  promptText: string
  trackedPromptId: string
}

export interface ProviderExecutionResult {
  citations: ExtractedCitation[]
  errorCode: string | null
  errorMessage: string | null
  inputTokens: number | null
  latencyMs: number | null
  outputTokens: number | null
  projectId: string
  projectTopicId: string
  promptText: string
  providerId: "chatgpt" | "claude" | "perplexity"
  providerModel: string | null
  rawResponseJson: Record<string, unknown> | null
  rawResponseText: string | null
  respondedAt: string | null
  status: PromptRunResponseStatus
  trackedPromptId: string
}

export interface AnalyzeResponsesPayload {
  brands: BrandEntity[]
  cadenceDays: PromptRunCadenceDays
  configId: string
  projectId: string
  responses: ProviderExecutionResult[]
  scheduledFor: string
  startedAt: string
  trackedPrompts: TrackedPrompt[]
  triggerType: ConfiguredPromptRunTriggerType
}

export interface AnalyzedResponseBrandMetric {
  brandEntityId: string
  citationScore: number
  citationUrls: string[]
  mentionCount: number
  rankPosition: number | null
  recommendationStatus: RecommendationStatus
  sentimentLabel: SentimentLabel
  sentimentScore: number | null
  visibilityScore: number
}

export interface DiscoveredCompetitorCandidate {
  description: string
  evidenceQuote: string
  name: string
  websiteUrl: string
}

export interface AnalyzedProviderExecutionResult extends ProviderExecutionResult {
  brandMetrics: AnalyzedResponseBrandMetric[]
  responseSummary: string
}

export interface AnalyzedPromptRun {
  failureReason: string | null
  projectTopicId: string
  promptText: string
  providerResults: AnalyzedProviderExecutionResult[]
  status: PromptRunStatus
  trackedPromptId: string
}

export interface AnalyzedRunPayload {
  brands: BrandEntity[]
  cadenceApplied: PromptRunCadence
  cadenceDays: PromptRunCadenceDays
  completedAt: string
  configId: string
  discoveredCompetitors: DiscoveredCompetitorCandidate[]
  projectId: string
  promptRuns: AnalyzedPromptRun[]
  scheduledFor: string
  startedAt: string
  trackedPrompts: TrackedPrompt[]
  triggerType: ConfiguredPromptRunTriggerType
}

export function toPromptRunCadence(
  cadenceDays: PromptRunCadenceDays,
  triggerType: ConfiguredPromptRunTriggerType
): PromptRunCadence {
  if (triggerType === "manual") {
    return "manual"
  }

  switch (cadenceDays) {
    case 1:
      return "daily"
    case 2:
      return "every_2_days"
    case 3:
      return "every_3_days"
    case 7:
      return "weekly"
  }
}

export function buildPromptRunTags(config: PromptRunConfig) {
  return [
    `project:${config.project_id}`,
    `trigger:${config.is_enabled ? "scheduled" : "manual"}`,
    `cadence:${config.cadence_days}d`,
    `config:${config.id}`,
    "runner:prompt-runs",
  ]
}

function getZonedParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone,
    year: "numeric",
  })

  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  )

  return {
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    month: Number(parts.month),
    second: Number(parts.second),
    year: Number(parts.year),
  }
}

function getTimeZoneOffsetMilliseconds(date: Date, timeZone: string) {
  const parts = getZonedParts(date, timeZone)
  const zonedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  )

  return zonedAsUtc - date.getTime()
}

function toUtcDateForZone(input: {
  day: number
  hour: number
  minute: number
  month: number
  timeZone: string
  year: number
}) {
  const guess = new Date(
    Date.UTC(input.year, input.month - 1, input.day, input.hour, input.minute)
  )
  const offset = getTimeZoneOffsetMilliseconds(guess, input.timeZone)
  const candidate = new Date(guess.getTime() - offset)
  const correctedOffset = getTimeZoneOffsetMilliseconds(candidate, input.timeZone)

  if (correctedOffset === offset) {
    return candidate
  }

  return new Date(guess.getTime() - correctedOffset)
}

export function calculateNextPromptRunAt(input: {
  cadenceDays: PromptRunCadenceDays
  referenceDate?: Date
  scheduledRunLocalTime: string
  timeZone: string
}) {
  const referenceDate = input.referenceDate ?? new Date()
  const [scheduledHour, scheduledMinute] = input.scheduledRunLocalTime
    .split(":")
    .map((value) => Number(value))
  const referenceParts = getZonedParts(referenceDate, input.timeZone)

  let candidate = toUtcDateForZone({
    day: referenceParts.day,
    hour: scheduledHour,
    minute: scheduledMinute,
    month: referenceParts.month,
    timeZone: input.timeZone,
    year: referenceParts.year,
  })

  if (candidate <= referenceDate) {
    candidate = toUtcDateForZone({
      day: referenceParts.day + input.cadenceDays,
      hour: scheduledHour,
      minute: scheduledMinute,
      month: referenceParts.month,
      timeZone: input.timeZone,
      year: referenceParts.year,
    })
  }

  return candidate
}

export function isPromptRunClaimStale(
  claimedAt: string | null,
  referenceDate = new Date()
) {
  if (!claimedAt) {
    return true
  }

  const claimedTime = new Date(claimedAt).getTime()

  if (Number.isNaN(claimedTime)) {
    return true
  }

  return (
    referenceDate.getTime() - claimedTime >
    PROMPT_RUN_CLAIM_WINDOW_MINUTES * 60 * 1000
  )
}

export function summarizePromptRunStatus(
  providerResults: Pick<ProviderExecutionResult, "errorMessage" | "providerId" | "status">[]
) {
  const failed = providerResults.filter(
    (result) => result.status !== "completed"
  )

  if (failed.length === 0) {
    return {
      failureReason: null,
      status: "completed" as const,
    }
  }

  if (failed.length === providerResults.length) {
    return {
      failureReason: failed
        .map(
          (result) =>
            `${result.providerId}: ${result.errorMessage ?? result.status}`
        )
        .join("; "),
      status: "failed" as const,
    }
  }

  return {
    failureReason: failed
      .map(
        (result) => `${result.providerId}: ${result.errorMessage ?? result.status}`
      )
      .join("; "),
    status: "partial" as const,
  }
}
