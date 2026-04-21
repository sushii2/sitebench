export const promptRunProviderIds = [
  "chatgpt",
  "claude",
  "perplexity",
] as const

export const promptRunCadenceDays = [1, 2, 3, 7] as const

export type PromptRunProviderId = (typeof promptRunProviderIds)[number]
export type PromptRunCadenceDays = (typeof promptRunCadenceDays)[number]

export interface PromptRunConfig {
  id: string
  project_id: string
  cadence_days: PromptRunCadenceDays
  scheduled_run_local_time: string
  enabled_providers: PromptRunProviderId[]
  selected_tracked_prompt_ids: string[]
  selected_project_topic_ids: string[]
  is_enabled: boolean
  last_run_at: string | null
  next_run_at: string | null
  claimed_at: string | null
  current_run_id: string | null
  created_at: string
  updated_at: string
}

export interface PromptRunConfigInput {
  projectId: string
  cadenceDays: PromptRunCadenceDays
  scheduledRunLocalTime: string
  enabledProviders: PromptRunProviderId[]
  selectedTrackedPromptIds: string[]
  selectedProjectTopicIds: string[]
  isEnabled?: boolean
}

export interface PromptRunConfigRuntimeUpdate {
  claimedAt?: string | null
  currentRunId?: string | null
  lastRunAt?: string | null
  nextRunAt?: string | null
}
