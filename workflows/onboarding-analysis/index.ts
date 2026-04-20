import { buildSeedBrandProfileStep } from "@/workflows/onboarding-analysis/steps/build-seed-brand-profile"
import { enhanceBrandProfileStep } from "@/workflows/onboarding-analysis/steps/enhance-brand-profile"
import { failRunStep } from "@/workflows/onboarding-analysis/steps/fail-run"
import { finalizeRunStep } from "@/workflows/onboarding-analysis/steps/finalize-run"
import { generateCompetitorCandidatesStep } from "@/workflows/onboarding-analysis/steps/generate-competitor-candidates"
import { generateTopicsAndPromptsStep } from "@/workflows/onboarding-analysis/steps/generate-topics-and-prompts"
import { initializeRunStep } from "@/workflows/onboarding-analysis/steps/initialize-run"
import { scrapeHomepageStep } from "@/workflows/onboarding-analysis/steps/scrape-homepage"
import type { OnboardingAnalysisWorkflowInput } from "@/workflows/onboarding-analysis/types"

export type { OnboardingAnalysisWorkflowInput } from "@/workflows/onboarding-analysis/types"

export async function onboardingAnalysisWorkflow(
  input: OnboardingAnalysisWorkflowInput
) {
  "use workflow"

  try {
    const initialized = await initializeRunStep(input)
    const homepage = await scrapeHomepageStep(initialized)
    const seeded = await buildSeedBrandProfileStep(homepage)
    const profiled = await enhanceBrandProfileStep(seeded)
    const generatedCompetitors = await generateCompetitorCandidatesStep(profiled)
    const prompted = await generateTopicsAndPromptsStep(generatedCompetitors)

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
