export type PromptCatalogSource = "seeded" | "researched" | "user_promoted"

export interface PromptCatalog {
  id: string
  topic_catalog_id: string | null
  prompt_text: string
  normalized_prompt: string
  intent: string | null
  source: PromptCatalogSource
  is_active: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}
