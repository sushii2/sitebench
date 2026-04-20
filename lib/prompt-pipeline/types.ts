import { z } from "zod"

import type { PromptRun } from "@/lib/prompt-runs/types"
import type { ProjectTopic } from "@/lib/project-topics/types"
import type {
  RecommendationStatus,
  SentimentLabel,
} from "@/lib/response-brand-metrics/types"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

export const promptPipelineFrequencyValues = [
  "daily",
  "every_2_days",
  "every_3_days",
  "weekly",
  "every_2_weeks",
] as const

export type PromptPipelineFrequency =
  (typeof promptPipelineFrequencyValues)[number]

export const promptPipelineTriggerTypeValues = [
  "scheduled",
  "manual",
] as const

export type PromptPipelineTriggerType =
  (typeof promptPipelineTriggerTypeValues)[number]

export const promptPipelineRunStatusValues = [
  "queued",
  "running",
  "completed",
  "partial",
  "failed",
  "cancelled",
] as const

export type PromptPipelineRunStatus =
  (typeof promptPipelineRunStatusValues)[number]

export interface PromptPipelineConfig {
  id: string
  project_id: string
  frequency: PromptPipelineFrequency
  is_enabled: boolean
  next_run_at: string | null
  last_run_at: string | null
  last_run_status: PromptPipelineRunStatus | null
  last_failure_message: string | null
  last_pipeline_run_id: string | null
  anchor_timezone: string
  selected_prompt_ids: string[]
  created_at: string
  updated_at: string
}

export interface PromptPipelineConfigPrompt {
  id: string
  config_id: string
  tracked_prompt_id: string
  created_at: string
}

export interface PromptPipelineRun {
  id: string
  project_id: string
  config_id: string
  trigger_type: PromptPipelineTriggerType
  status: PromptPipelineRunStatus
  scheduled_for: string
  workflow_run_id: string | null
  request_id: string | null
  selection_snapshot_json: Record<string, unknown> | null
  prompt_count_total: number
  prompt_count_completed: number
  prompt_count_partial: number
  prompt_count_failed: number
  failure_reason: string | null
  created_at: string
  updated_at: string
}

export const promptPipelineRunTraceStatusValues = [
  "running",
  "completed",
  "failed",
  "cancelled",
] as const

export type PromptPipelineRunTraceStatus =
  (typeof promptPipelineRunTraceStatusValues)[number]

export interface PromptPipelineRunTrace {
  id: string
  pipeline_run_id: string
  step_key: string
  status: PromptPipelineRunTraceStatus
  message: string
  detail_json: Record<string, unknown>
  created_at: string
}

export interface PromptPipelineRunWithTrace extends PromptPipelineRun {
  traces: PromptPipelineRunTrace[]
}

export interface PromptPipelineWorkflowPrompt {
  prompt_run_id: string
  project_topic_id: string
  topic_name: string
  tracked_prompt_id: string
  prompt_text: string
}

export interface PromptPipelineConfigScreenData {
  activeTopics: ProjectTopic[]
  activePrompts: TrackedPrompt[]
  config: PromptPipelineConfig | null
  hasActiveRun: boolean
  latestRun: PromptPipelineRunWithTrace | null
  reportingTimezone?: string
}

export interface PromptRunChatCitation {
  id: string
  url: string
  pageTitle: string | null
  citationText: string | null
}

export interface PromptRunChatBrand {
  id: string
  name: string
  visibilityScore: number
  recommendationStatus: RecommendationStatus
  sentimentLabel: SentimentLabel
  citationCount: number
}

export interface PromptRunChatProviderResponse {
  platformCode: string
  rawResponseText: string | null
  rawResponseJson: Record<string, unknown> | null
  errorMessage: string | null
  citations: PromptRunChatCitation[]
  brands: PromptRunChatBrand[]
}

export interface PromptRunChatRecentRun {
  id: string
  promptText: string
  topicName: string
  status: PromptRun["status"]
  ranAt: string | null
}

export interface PromptRunChatPayload {
  promptRun: PromptRun
  topicName: string
  trackedPromptText: string
  providerResponses: PromptRunChatProviderResponse[]
  recentPromptRuns: PromptRunChatRecentRun[]
}

export const promptPipelineFrequencySchema = z.enum(
  promptPipelineFrequencyValues
)

export const promptPipelineRunStatusSchema = z.enum(
  promptPipelineRunStatusValues
)

export const promptPipelineConfigRequestSchema = z.object({
  frequency: promptPipelineFrequencySchema,
  selectedPromptIds: z
    .array(z.string().trim().min(1))
    .min(1, "At least one prompt must be selected."),
})

export const promptPipelineQuickRunResponseSchema = z.object({
  pipelineRunId: z.string().min(1),
  status: promptPipelineRunStatusSchema,
  workflowRunId: z.string().min(1),
})
