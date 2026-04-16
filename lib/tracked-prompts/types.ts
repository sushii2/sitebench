export type TrackedPromptAddedVia =
  | "user_selected"
  | "user_created"
  | "ai_suggested"
  | "system_seeded"

export interface TrackedPrompt {
  id: string
  project_id: string
  project_topic_id: string
  prompt_catalog_id: string | null
  prompt_text: string
  normalized_prompt: string
  cadence_override: "daily" | "weekly" | "monthly" | null
  added_via: TrackedPromptAddedVia
  is_active: boolean
  next_run_at: string | null
  last_run_at: string | null
  created_at: string
  updated_at: string
}
