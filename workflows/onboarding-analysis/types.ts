import type {
  OnboardingAnalysisResult,
  OnboardingBrandProfile,
  OnboardingCompetitor,
  OnboardingCriticalPageSelection,
  OnboardingHomepageClassification,
  OnboardingScrapeContext,
  OnboardingTopicDraft,
} from "@/lib/onboarding/types"
import type {
  ClassifiedMappedPage,
  MappedPageCandidate,
} from "@/lib/onboarding/analysis-selection"

export interface OnboardingAnalysisWorkflowInput {
  analysisId: string
  analysisVersion: number
  authToken: string
  companyName: string
  projectId: string
  website: string
}

export interface WorkflowState extends OnboardingAnalysisWorkflowInput {
  timings: Record<string, number>
  warnings: string[]
}

export interface MappedState extends WorkflowState {
  mappedPages: MappedPageCandidate[]
}

export interface HomepageState extends MappedState {
  homepage: OnboardingScrapeContext | null
}

export interface ClassifiedState extends HomepageState {
  homepageClassification: OnboardingHomepageClassification
}

export interface PrefilteredState extends ClassifiedState {
  classifiedPages: ClassifiedMappedPage[]
  prefilteredPages: ClassifiedMappedPage[]
}

export type SelectedCriticalPage = OnboardingCriticalPageSelection["pages"][number] & {
  candidateScore: number
  description?: string | null
  title?: string | null
}

export interface SelectedState extends PrefilteredState {
  selectedPages: SelectedCriticalPage[]
}

export interface ScrapedSelectedPage {
  description?: string | null
  expectedSignals: string[]
  html: string
  markdown: string
  metaDescription?: string | null
  pageRole: SelectedCriticalPage["pageRole"]
  priority: number
  title?: string | null
  url: string
  whySelected: string
}

export interface ScrapedState extends SelectedState {
  scrapedPages: ScrapedSelectedPage[]
}

export interface ProfiledState extends ScrapedState {
  brandProfile: OnboardingBrandProfile
}

export interface CompetitorState extends ProfiledState {
  competitors: OnboardingCompetitor[]
}

export interface PromptedState extends CompetitorState {
  result: OnboardingAnalysisResult
  topics: OnboardingTopicDraft[]
}
