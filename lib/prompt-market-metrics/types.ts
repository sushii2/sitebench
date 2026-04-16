export interface PromptMarketMetric {
  id: string
  prompt_catalog_id: string
  platform_code: string
  observed_on: string
  estimated_volume: number | null
  trend_score: number | null
  trend_delta: number | null
  source_name: string
  created_at: string
}
