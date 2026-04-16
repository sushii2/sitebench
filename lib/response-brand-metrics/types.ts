export type RecommendationStatus =
  | "recommended"
  | "mentioned"
  | "not_recommended"
export type SentimentLabel = "positive" | "neutral" | "negative" | "mixed"

export interface ResponseBrandMetric {
  id: string
  project_id: string
  response_id: string
  brand_entity_id: string
  rank_position: number | null
  mention_count: number
  visibility_score: number
  recommendation_status: RecommendationStatus
  sentiment_label: SentimentLabel
  sentiment_score: number | null
  citation_score: number
  created_at: string
}
