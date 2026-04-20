export type PromptRunTriggerType = "scheduled" | "manual" | "backfill"
export type PromptRunCadence =
  | "daily"
  | "every_2_days"
  | "every_3_days"
  | "weekly"
  | "every_2_weeks"
  | "manual"
export type PromptRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "cancelled"

export interface PromptRun {
  id: string
  project_id: string
  project_topic_id: string
  tracked_prompt_id: string
  pipeline_run_id: string | null
  trigger_type: PromptRunTriggerType
  cadence_applied: PromptRunCadence
  status: PromptRunStatus
  scheduled_for: string
  started_at: string | null
  completed_at: string | null
  failure_reason: string | null
  created_at: string
}
