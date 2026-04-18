export type SiteCrawlPageType =
  | "homepage"
  | "product"
  | "pricing"
  | "comparison"
  | "blog"
  | "excluded"

export interface SiteCrawlPage {
  id: string
  crawl_run_id: string
  project_id: string
  canonical_url: string
  page_type: SiteCrawlPageType
  selection_score: number
  selection_reason: string
  title: string | null
  meta_description: string | null
  content_snapshot: string
  entities_json: Record<string, unknown>
  intents_json: Record<string, unknown>
  competitor_candidates_json: Record<string, unknown>
  page_metadata_json: Record<string, unknown>
  created_at: string
  updated_at: string
}
