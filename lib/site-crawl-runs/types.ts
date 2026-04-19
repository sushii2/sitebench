export type SiteCrawlRunTriggerType = "onboarding"

export type SiteCrawlRunStatus =
  | "mapping"
  | "classifying"
  | "planning"
  | "scraping"
  | "profiling"
  | "competitors"
  | "prompting"
  | "completed"
  | "failed"

export interface SiteCrawlRun {
  id: string
  analysis_version: number
  project_id: string
  trigger_type: SiteCrawlRunTriggerType
  status: SiteCrawlRunStatus
  firecrawl_job_ids: string[]
  selected_url_count: number
  workflow_run_id: string | null
  warnings: string[]
  result_json: Record<string, unknown> | null
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}
