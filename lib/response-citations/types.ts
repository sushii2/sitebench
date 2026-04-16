export interface ResponseCitation {
  id: string
  project_id: string
  response_id: string
  source_page_id: string
  citation_order: number | null
  cited_url: string
  citation_text: string | null
  authority_score: number | null
  created_at: string
}
