export type TopicCadence = "daily" | "weekly" | "monthly"
export type TopicSource = "user_added" | "ai_suggested" | "system_seeded"

export interface ProjectTopic {
  id: string
  project_id: string
  topic_catalog_id: string | null
  name: string
  normalized_name: string
  default_cadence: TopicCadence
  source: TopicSource
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}
