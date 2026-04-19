export type SiteCrawlMappedCandidateBucket =
  | "homepage"
  | "pricing"
  | "product_hub"
  | "category_hub"
  | "solution_page"
  | "integration_page"
  | "comparison_page"
  | "proof_page"
  | "about"
  | "careers"
  | "editorial"
  | "geography"
  | "product_detail"
  | "utility"

export interface SiteCrawlMappedPage {
  id: string
  crawl_run_id: string
  project_id: string
  canonical_url: string
  candidate_bucket: SiteCrawlMappedCandidateBucket
  candidate_reason: string
  candidate_score: number
  title: string | null
  meta_description: string | null
  created_at: string
  updated_at: string
}
