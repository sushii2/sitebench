export type OnboardingStatus = "draft" | "complete"

export interface TrackingProject {
  id: string
  user_id: string
  market_category: string | null
  reporting_timezone: string
  onboarding_status: OnboardingStatus
  onboarding_completed_at: string | null
  created_at: string
  updated_at: string
}
