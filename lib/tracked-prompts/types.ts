export type TrackedPromptAddedVia =
  | "user_selected"
  | "user_created"
  | "ai_suggested"
  | "system_seeded"

export type TrackedPromptVariantType =
  | "discovery"
  | "comparison"
  | "alternatives"
  | "pricing"
  | "implementation"
  | "use_case"
  | "migration"
  | "roi"
  | "integration"
  | "competitor_specific"

export type TrackedPromptScoreStatus = "scored" | "stale" | "unscored"

export interface TrackedPrompt {
  id: string
  project_id: string
  project_topic_id: string
  prompt_catalog_id: string | null
  prompt_text: string
  normalized_prompt: string
  cadence_override: "daily" | "weekly" | "monthly" | null
  added_via: TrackedPromptAddedVia
  variant_type: TrackedPromptVariantType | null
  pqs_score: number | null
  pqs_rank: number | null
  score_status: TrackedPromptScoreStatus
  score_metadata: Record<string, unknown>
  source_analysis_run_id: string | null
  is_active: boolean
  next_run_at: string | null
  last_run_at: string | null
  last_run_status:
    | "queued"
    | "running"
    | "completed"
    | "partial"
    | "failed"
    | "cancelled"
    | null
  last_failure_message: string | null
  last_chat_prompt_run_id: string | null
  created_at: string
  updated_at: string
}
