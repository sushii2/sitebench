import { buildBrandProfileStep } from "@/workflows/onboarding-analysis/steps/build-brand-profile"
import { classifyHomepageStep } from "@/workflows/onboarding-analysis/steps/classify-homepage"
import { failRunStep } from "@/workflows/onboarding-analysis/steps/fail-run"
import { finalizeRunStep } from "@/workflows/onboarding-analysis/steps/finalize-run"
import { generateCompetitorCandidatesStep } from "@/workflows/onboarding-analysis/steps/generate-competitor-candidates"
import { generateTopicsAndPromptsStep } from "@/workflows/onboarding-analysis/steps/generate-topics-and-prompts"
import { initializeRunStep } from "@/workflows/onboarding-analysis/steps/initialize-run"
import { mapWebsiteStep } from "@/workflows/onboarding-analysis/steps/map-website"
import { prefilterMappedPagesStep } from "@/workflows/onboarding-analysis/steps/prefilter-mapped-pages"
import { scrapeHomepageStep } from "@/workflows/onboarding-analysis/steps/scrape-homepage"
import { scrapeSelectedPagesStep } from "@/workflows/onboarding-analysis/steps/scrape-selected-pages"
import { scoreCompetitorsStep } from "@/workflows/onboarding-analysis/steps/score-competitors"
import { selectCriticalPagesStep } from "@/workflows/onboarding-analysis/steps/select-critical-pages"
import type { OnboardingAnalysisWorkflowInput } from "@/workflows/onboarding-analysis/types"

export type { OnboardingAnalysisWorkflowInput } from "@/workflows/onboarding-analysis/types"

export async function onboardingAnalysisWorkflow(
  input: OnboardingAnalysisWorkflowInput
) {
  "use workflow"

  try {
    const initialized = await initializeRunStep(input)
    const mapped = await mapWebsiteStep(initialized)
    const homepage = await scrapeHomepageStep(mapped)
    const classified = await classifyHomepageStep(homepage)
    const prefiltered = await prefilterMappedPagesStep(classified)
    const selected = await selectCriticalPagesStep(prefiltered)
    const scraped = await scrapeSelectedPagesStep(selected)
    const profiled = await buildBrandProfileStep(scraped)
    const generatedCompetitors = await generateCompetitorCandidatesStep(profiled)
    const scoredCompetitors = await scoreCompetitorsStep(generatedCompetitors)
    const prompted = await generateTopicsAndPromptsStep(scoredCompetitors)

    return await finalizeRunStep(prompted)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "The workflow failed before onboarding analysis could complete."

    await failRunStep({
      analysisId: input.analysisId,
      authToken: input.authToken,
      message,
      warnings: [],
    })

    throw error
  }
}
