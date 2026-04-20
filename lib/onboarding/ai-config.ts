import {
  getLanguageModel,
  getParallelWebSearchTool,
} from "@/lib/ai/provider-config"

export const ONBOARDING_MODEL_ID = "openai/gpt-5.4"

export const ONBOARDING_STRUCTURED_OUTPUT_PROVIDER_OPTIONS = {
  openai: {
    store: false,
    textVerbosity: "low",
  },
} as const

export const ONBOARDING_SEARCH_PROVIDER_OPTIONS = {
  openai: {
    parallelToolCalls: false,
    store: false,
    textVerbosity: "low",
  },
} as const

const ONBOARDING_PARALLEL_SEARCH_CONFIG = {
  excerpts: {
    maxCharsPerResult: 1200,
    maxCharsTotal: 7200,
  },
  fetchPolicy: {
    maxAgeSeconds: 60 * 60 * 24,
  },
  maxResults: 6,
  mode: "agentic",
} as const

export function getOnboardingStructuredOutputModel() {
  return getLanguageModel("openai", {
    capability: "structuredOutput",
    modelId: ONBOARDING_MODEL_ID,
  })
}

export function getOnboardingSearchModel() {
  // Parallel Search is attached via `tools`, so keep onboarding on the base
  // GPT-5.4 structured-output path instead of the native web-search capability.
  return getLanguageModel("openai", {
    capability: "structuredOutput",
    modelId: ONBOARDING_MODEL_ID,
  })
}

export function getOnboardingSearchTools() {
  return {
    parallel_search: getParallelWebSearchTool(ONBOARDING_PARALLEL_SEARCH_CONFIG),
  }
}
