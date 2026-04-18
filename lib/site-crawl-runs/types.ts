export type SiteCrawlRunTriggerType = "onboarding"

export type SiteCrawlRunStatus =
  | "mapping"
  | "crawling"
  | "extracting"
  | "clustering"
  | "prompting"
  | "scoring"
  | "completed"
  | "failed"

export interface SiteCrawlRun {
  id: string
  project_id: string
  trigger_type: SiteCrawlRunTriggerType
  status: SiteCrawlRunStatus
  firecrawl_job_ids: string[]
  selected_url_count: number
  warnings: string[]
  result_json: Record<string, unknown> | null
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}
