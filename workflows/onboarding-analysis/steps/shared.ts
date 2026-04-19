import { createAuthenticatedOnboardingClientFromToken } from "@/lib/onboarding/auth"
import {
  logOnboardingAnalysisError,
  logOnboardingAnalysisEvent,
} from "@/lib/onboarding/analysis-logging"
import { updateSiteCrawlRun } from "@/lib/site-crawl-runs/repository"
import type { SiteCrawlRunStatus } from "@/lib/site-crawl-runs/types"

export function uniqueWarnings(warnings: string[]) {
  return [...new Set(warnings.map((warning) => warning.trim()).filter(Boolean))]
}

export function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

export function stripMarkdown(value: string) {
  return normalizeWhitespace(
    value
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
      .replace(/[#>*_~|-]/g, " ")
  )
}

export function takeDurationMs(startedAt: number) {
  return Date.now() - startedAt
}

export function extendTimings(
  timings: Record<string, number>,
  key: string,
  startedAt: number
) {
  return {
    ...timings,
    [key]: takeDurationMs(startedAt),
  }
}

export async function persistRunPhase(input: {
  analysisId: string
  authToken: string
  selectedUrlCount?: number
  status: SiteCrawlRunStatus
  warnings: string[]
}) {
  const client = createAuthenticatedOnboardingClientFromToken(input.authToken)

  await updateSiteCrawlRun(client, input.analysisId, {
    selected_url_count: input.selectedUrlCount,
    status: input.status,
    warnings: uniqueWarnings(input.warnings),
  })
}

export function logStepEvent(
  message: string,
  details?: Record<string, unknown>
) {
  logOnboardingAnalysisEvent(message, details)
}

export function createWorkflowOnboardingClient(authToken: string) {
  return createAuthenticatedOnboardingClientFromToken(authToken)
}

export function logStepError(
  message: string,
  error: unknown,
  details?: Record<string, unknown>
) {
  logOnboardingAnalysisError(message, error, details)
}

export function toErrorWarning(prefix: string, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown error"

  return `${prefix} ${message}`
}

export function tokenize(value: string) {
  return normalizeWhitespace(value)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3)
}

export function scoreOverlap(left: string[], right: string[]) {
  if (left.length === 0 || right.length === 0) {
    return 0
  }

  const rightSet = new Set(right)
  const matches = left.filter((token) => rightSet.has(token)).length

  return matches / Math.max(left.length, right.length)
}
