export type BrandRole = "primary" | "competitor"

export interface BrandEntity {
  id: string
  project_id: string
  role: BrandRole
  name: string
  normalized_name: string
  website_url: string
  website_host: string
  description: string
  sort_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}
