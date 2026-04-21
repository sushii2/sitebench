export type PromptRunTriggerType = "scheduled" | "manual" | "backfill"
export type PromptRunCadence =
  | "daily"
  | "every_2_days"
  | "every_3_days"
  | "weekly"
  | "manual"
export type PromptRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "partial"
  | "failed"

export interface PromptRun {
  id: string
  project_id: string
  project_topic_id: string
  tracked_prompt_id: string
  trigger_type: PromptRunTriggerType
  cadence_applied: PromptRunCadence
  status: PromptRunStatus
  scheduled_for: string
  started_at: string | null
  completed_at: string | null
  failure_reason: string | null
  created_at: string
}
