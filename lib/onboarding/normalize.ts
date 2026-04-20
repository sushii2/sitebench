import { generateText } from "ai"

import {
  buildGatewayStructuredOutputSystemPrompt,
  createGatewayStructuredObjectOutput,
} from "@/lib/ai/gateway-structured-output"
import {
  getOnboardingSearchTools,
  getOnboardingSearchModel,
  getOnboardingStructuredOutputModel,
  ONBOARDING_SEARCH_PROVIDER_OPTIONS,
  ONBOARDING_STRUCTURED_OUTPUT_PROVIDER_OPTIONS,
} from "@/lib/onboarding/ai-config"
import { normalizeBrandTopics, normalizeDescription, normalizeWebsite } from "@/lib/brands"
import {
  onboardingAiSuggestionSchema,
  onboardingBrandResponseSchema,
  onboardingCompetitorRecoverySchema,
  type OnboardingAiSuggestion,
  type OnboardingBrandRequest,
  type OnboardingBrandResponse,
  type OnboardingCompetitorRecovery,
  type OnboardingScrapeContext,
} from "@/lib/onboarding/types"
import { createSingleSearchStructuredOutputLoopControl } from "@/lib/onboarding/search-loop-control"

const MIN_COMPETITORS_WARNING_THRESHOLD = 4
const MAX_COMPETITORS = 5
const MAX_DESCRIPTION_LENGTH = 500
const FALLBACK_DESCRIPTION_SEGMENT_LENGTH = 320
const TIER_TWO_FAILURE_WARNING =
  "We could not improve competitors with web search. Review and add competitors if needed."

const ONBOARDING_SYSTEM_PROMPT = buildGatewayStructuredOutputSystemPrompt([
  "You are an expert GEO/AEO onboarding analysis assistant.",
  "Your job is to analyze a scraped website homepage and return only the onboarding fields required by the schema: description, topics, and competitors.",
  "Do not write like a marketer. Do not embellish. Do not guess when the homepage does not support a conclusion.",
  "Use the homepage URL and raw homepage markdown as the primary evidence.",
  "First identify the brand's category, buyer, core offering, and main use cases from the strongest homepage evidence such as the hero, product sections, use case language, feature blocks, FAQs, and metadata embedded in the page copy.",
  "Then write a concise customer-facing description that explains what the company does, what category it is in, who it appears to serve, and its main product or service focus.",
  `The description must be strictly less than ${MAX_DESCRIPTION_LENGTH} characters.`,
  "Generate 4 to 5 high-quality topics whenever the homepage gives enough signal.",
  "Topics must be natural AI-search monitoring themes that real buyers, users, or researchers would ask in ChatGPT, Perplexity, or Google AI search.",
  "Topics must reflect category, problem, use case, vendor evaluation, implementation guidance, or comparison intent when supported by the homepage.",
  "Do not output generic SEO keywords, internal jargon, vague growth terms, or branded filler.",
  "Generate 3 to 5 true competitors when category evidence is strong.",
  "A competitor must solve a similar core problem for a similar buyer.",
  "Use explicit comparison or displacement clues first, then conservative category inference only when the category and job-to-be-done are unambiguous.",
  "Do not treat customers, partners, integrations, investors, marketplaces, publishers, agencies, or adjacent tools as competitors unless the homepage clearly shows they are direct competitors.",
  "Prefer official competitor homepage URLs.",
  "If confidence is weak, return fewer competitors or an empty array instead of guessing.",
  "Ignore low-signal content such as cookie banners, legal boilerplate, repetitive CTA text, generic claims, and navigation labels unless they add real evidence.",
  "If you are unsure about a field, return an empty string or empty array for that field instead of hallucinating.",
  "Do not include the input company as its own competitor.",
  "Use concise, customer-facing language and keep the description factual.",
  "Topics should sound like realistic buyer research questions or monitoring themes, not keyword fragments.",
  "Competitors must be direct substitutes, not ecosystem companies or adjacent vendors.",
  "IMPORTANT: Focus only on the expected fields from the model response. Return only description, topics, and competitors.",
  "IMPORTANT: Do not add explanations, metadata, evidence, confidence labels, reasoning, or extra structure.",
  "IMPORTANT: Principles: Validate outcomes, iterate if needed, efficiency.",
])

const COMPETITOR_RECOVERY_SYSTEM_PROMPT =
  buildGatewayStructuredOutputSystemPrompt([
  "You are an expert competitive intelligence assistant for onboarding.",
  "Use web search only to recover direct competitors for a specific company when homepage evidence alone was insufficient.",
  "Call parallel_search at most once.",
  "Anchor your search on the supplied company name, website, Tier 1 description, and Tier 1 topics.",
  "Return only the competitors field expected by the schema.",
  "A competitor must solve a similar core problem for a similar buyer.",
  "Exclude the input company, customers, partners, integrations, marketplaces, publishers, agencies, and adjacent tools.",
  "Prefer official competitor homepage URLs.",
  "If evidence is weak, return fewer competitors or an empty array instead of guessing.",
  "Favor competitors repeatedly mentioned across reputable search results over speculative long-tail matches.",
  "IMPORTANT: Focus only on the expected fields from the model response.",
  "IMPORTANT: Principles: Validate outcomes, iterate if needed, efficiency.",
])

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function truncateDescription(value: string) {
  const normalized = normalizeDescription(value)

  if (normalized.length <= MAX_DESCRIPTION_LENGTH) {
    return normalized
  }

  return normalized.slice(0, MAX_DESCRIPTION_LENGTH).trimEnd()
}

function mergeWarnings(...warningGroups: Array<string[]>) {
  return [...new Set(warningGroups.flat().map((warning) => warning.trim()).filter(Boolean))]
}

function deriveQualityWarnings(result: Omit<OnboardingBrandResponse, "warnings">) {
  const warnings: string[] = []

  if (!result.description) {
    warnings.push("We could not suggest a description. Please add one manually.")
  }

  if (result.topics.length < 3) {
    warnings.push(
      "We found fewer than 3 strong topics. Review and add topics before continuing."
    )
  }

  if (result.competitors.length < MIN_COMPETITORS_WARNING_THRESHOLD) {
    warnings.push(
      "We found fewer than 4 competitors. Review and add competitors if needed."
    )
  }

  return warnings
}

function createTierOnePrompt(input: OnboardingBrandRequest & { context: OnboardingScrapeContext }) {
  return [
    `Brand name: ${input.companyName}`,
    `Brand website: ${normalizeWebsite(input.website)}`,
    `Homepage URL: ${input.context.url}`,
    "",
    `Homepage HTML:\n${input.context.html}`,
    "",
    `Homepage markdown:\n${input.context.markdown}`,
  ].join("\n")
}

function createTierTwoPrompt(input: {
  companyName: string
  website: string
  tierOneResult: OnboardingBrandResponse
}) {
  return [
    `Brand name: ${input.companyName}`,
    `Brand website: ${normalizeWebsite(input.website)}`,
    `Tier 1 description: ${input.tierOneResult.description || "(empty)"}`,
    `Tier 1 topics: ${
      input.tierOneResult.topics.length > 0
        ? input.tierOneResult.topics.join(", ")
        : "(empty)"
    }`,
    "Find direct competitors for this company category and buyer.",
    "Return only official competitor homepages when possible.",
  ].join("\n")
}

function stripMarkdown(value: string) {
  return normalizeWhitespace(
    value
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
      .replace(/\[[^\]]+\]\([^)]+\)/g, " ")
      .replace(/[#>*_~|-]/g, " ")
  )
}

function extractFallbackDescription(markdown: string) {
  const segments = markdown
    .split(/\n\s*\n/)
    .map((segment) => stripMarkdown(segment))
    .filter((segment) => segment.length >= 20)

  if (segments.length === 0) {
    return ""
  }

  return truncateDescription(segments.slice(0, 2).join(" ").slice(0, FALLBACK_DESCRIPTION_SEGMENT_LENGTH))
}

function mergeCompetitorCandidates(
  base: OnboardingBrandResponse,
  recovered: OnboardingCompetitorRecovery
): OnboardingAiSuggestion {
  return {
    competitors: [
      ...base.competitors,
      ...recovered.competitors,
    ],
    description: base.description,
    topics: base.topics,
  }
}

async function recoverCompetitorsWithWebSearch(input: {
  companyName: string
  website: string
  tierOneResult: OnboardingBrandResponse
}) {
  const searchTools = getOnboardingSearchTools()
  const searchLoopControl = createSingleSearchStructuredOutputLoopControl(
    searchTools,
    "[onboarding] Tier 2 competitor recovery disabled tools for final structured output"
  )

  const { output } = await generateText({
    model: getOnboardingSearchModel(),
    output: createGatewayStructuredObjectOutput({
      description:
        "Structured direct competitor recovery for onboarding analysis.",
      name: "onboarding_competitor_recovery",
      schema: onboardingCompetitorRecoverySchema,
    }),
    system: COMPETITOR_RECOVERY_SYSTEM_PROMPT,
    prompt: createTierTwoPrompt(input),
    providerOptions: ONBOARDING_SEARCH_PROVIDER_OPTIONS,
    temperature: 0,
    tools: searchTools,
    ...searchLoopControl,
    onStepFinish({ finishReason, stepNumber, text, toolCalls, toolResults, usage }) {
      console.log("[onboarding] Tier 2 competitor recovery step finished", {
        finishReason,
        stepNumber,
        textLength: text.length,
        toolCallCount: toolCalls.length,
        toolResultCount: toolResults.length,
        usage,
      })
    },
  })

  return output
}

export function createEmptyOnboardingBrandResponse(
  warnings: string[] = []
): OnboardingBrandResponse {
  return onboardingBrandResponseSchema.parse({
    competitors: [],
    description: "",
    topics: [],
    warnings,
  })
}

export function postProcessOnboardingSuggestions(
  suggestion: OnboardingAiSuggestion,
  website: string
): OnboardingBrandResponse {
  const ownHostname = new URL(normalizeWebsite(website)).hostname
  const seenCompetitors = new Set<string>()
  const competitors = []

  for (const competitor of suggestion.competitors) {
    const name = normalizeWhitespace(competitor.name)
    const websiteInput = competitor.website.trim()

    if (!name || !websiteInput) {
      continue
    }

    let normalizedCompetitorWebsite: string

    try {
      normalizedCompetitorWebsite = normalizeWebsite(websiteInput)
    } catch {
      continue
    }

    const hostname = new URL(normalizedCompetitorWebsite).hostname
    const dedupeKey = `${hostname}:${name.toLowerCase()}`

    if (hostname === ownHostname || seenCompetitors.has(dedupeKey)) {
      continue
    }

    seenCompetitors.add(dedupeKey)
    competitors.push({
      name,
      website: normalizedCompetitorWebsite,
    })

    if (competitors.length >= MAX_COMPETITORS) {
      break
    }
  }

  const result = {
    competitors,
    description: truncateDescription(suggestion.description),
    topics: normalizeBrandTopics(suggestion.topics).slice(0, 10),
  }

  return onboardingBrandResponseSchema.parse({
    ...result,
    warnings: deriveQualityWarnings(result),
  })
}

export async function normalizeBrandOnboarding(
  input: OnboardingBrandRequest & { context: OnboardingScrapeContext }
): Promise<OnboardingBrandResponse> {
  console.log("[onboarding] Starting Tier 1 normalization", {
    companyName: input.companyName,
    htmlLength: input.context.html.length,
    markdownLength: input.context.markdown.length,
    url: input.context.url,
  })

  const { output } = await generateText({
    model: getOnboardingStructuredOutputModel(),
    output: createGatewayStructuredObjectOutput({
      description:
        "Structured homepage onboarding synthesis with description, topics, and competitors.",
      name: "onboarding_brand_suggestion",
      schema: onboardingAiSuggestionSchema,
    }),
    system: ONBOARDING_SYSTEM_PROMPT,
    prompt: createTierOnePrompt(input),
    providerOptions: ONBOARDING_STRUCTURED_OUTPUT_PROVIDER_OPTIONS,
    temperature: 0,
  })

  console.log("[onboarding] Tier 1 AI output", {
    competitorCount: output.competitors.length,
    descriptionLength: output.description.length,
    topics: output.topics,
  })

  const tierOneResult = postProcessOnboardingSuggestions(output, input.website)

  console.log("[onboarding] Tier 1 normalized output", {
    competitorCount: tierOneResult.competitors.length,
    descriptionLength: tierOneResult.description.length,
    topics: tierOneResult.topics,
    warnings: tierOneResult.warnings,
  })

  if (tierOneResult.competitors.length >= MIN_COMPETITORS_WARNING_THRESHOLD) {
    console.log("[onboarding] Final onboarding suggestions", tierOneResult)
    return tierOneResult
  }

  try {
    console.log("[onboarding] Starting Tier 2 competitor recovery", {
      companyName: input.companyName,
      tierOneCompetitorCount: tierOneResult.competitors.length,
      tierOneTopics: tierOneResult.topics,
    })

    const recoveredCompetitors = await recoverCompetitorsWithWebSearch({
      companyName: input.companyName,
      tierOneResult,
      website: input.website,
    })

    console.log("[onboarding] Tier 2 AI output", {
      competitorCount: recoveredCompetitors.competitors.length,
    })

    const finalResult = postProcessOnboardingSuggestions(
      mergeCompetitorCandidates(tierOneResult, recoveredCompetitors),
      input.website
    )

    console.log("[onboarding] Final onboarding suggestions", finalResult)

    return finalResult
  } catch (error) {
    console.error("[onboarding] Tier 2 competitor recovery failed", error)

    const fallbackResult = mergeOnboardingWarnings(
      [TIER_TWO_FAILURE_WARNING],
      tierOneResult
    )

    console.log("[onboarding] Final onboarding suggestions", fallbackResult)

    return fallbackResult
  }
}

export function buildFallbackOnboardingSuggestions(
  context: OnboardingScrapeContext,
  website: string
): OnboardingBrandResponse {
  return postProcessOnboardingSuggestions(
    {
      competitors: [],
      description: extractFallbackDescription(context.markdown),
      topics: [],
    },
    website
  )
}

export function mergeOnboardingWarnings(
  baseWarnings: string[],
  result: OnboardingBrandResponse
): OnboardingBrandResponse {
  return onboardingBrandResponseSchema.parse({
    ...result,
    warnings: mergeWarnings(baseWarnings, result.warnings),
  })
}
