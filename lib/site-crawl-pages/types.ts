export type SiteCrawlPageType =
  | "homepage"
  | "product_hub"
  | "pricing"
  | "category_hub"
  | "solution_page"
  | "integration_page"
  | "proof_page"
  | "comparison_page"
  | "geography_page"
  | "careers_page"
  | "editorial_page"
  | "other"

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
