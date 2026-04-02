export type OnboardingStep = 1 | 2 | 3 | 4

export interface Brand {
  id: string
  user_id: string
  company_name: string
  website: string
  description: string
  topics: string[]
  onboarding_completed_at: string | null
  created_at: string
  updated_at: string
}

export interface BrandCompetitor {
  id: string
  brand_id: string
  user_id: string
  name: string
  website: string
  created_at: string
  updated_at: string
}

export interface BrandWithCompetitors extends Brand {
  competitors: BrandCompetitor[]
}

export interface BrandDraftStep1Input {
  company_name: string
  website: string
}

export interface BrandDraftStep2Input {
  description: string
}

export interface BrandDraftStep3Input {
  topics: string[]
}

export type BrandDraftStepInput =
  | BrandDraftStep1Input
  | BrandDraftStep2Input
  | BrandDraftStep3Input

export interface BrandCompetitorInput {
  name: string
  website: string
}
