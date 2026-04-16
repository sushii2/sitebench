import { normalizeCompanyName } from "@/lib/brands"

type TopicIntent =
  | "visibility"
  | "citations"
  | "prompt_monitoring"
  | "competitor_analysis"
  | "optimization"
  | "reporting"
  | "generic"

type TopicPromptRecipe = {
  comparisonFocus: string
  discoveryNeed: string
  solutionCategory: string
}

const DEFAULT_AI_SURFACES = ["ChatGPT", "Gemini", "Perplexity"] as const

const AUDIENCE_PATTERNS = [
  /\bb2b marketing teams?\b/i,
  /\bmarketing teams?\b/i,
  /\bbrand teams?\b/i,
  /\bseo teams?\b/i,
  /\bgrowth teams?\b/i,
  /\bdemand gen teams?\b/i,
  /\bcontent teams?\b/i,
  /\bcommunications teams?\b/i,
  /\brevenue teams?\b/i,
  /\bsales teams?\b/i,
  /\bproduct teams?\b/i,
  /\bdeveloper teams?\b/i,
  /\bengineering teams?\b/i,
  /\becommerce teams?\b/i,
  /\bagencies?\b/i,
  /\bleaders?\b/i,
] as const

const SURFACE_PATTERNS = [
  { label: "ChatGPT", pattern: /\bchatgpt\b/i },
  { label: "Gemini", pattern: /\bgemini\b/i },
  { label: "Perplexity", pattern: /\bperplexity\b/i },
  { label: "Claude", pattern: /\bclaude\b/i },
  { label: "Google AI Mode", pattern: /\bgoogle ai mode\b/i },
  { label: "AI Overviews", pattern: /\bai overviews?\b/i },
] as const

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function removeCompanyName(value: string, companyName: string) {
  const normalizedCompanyName = normalizeCompanyName(companyName)

  return normalizeWhitespace(
    value.replace(new RegExp(escapeRegExp(normalizedCompanyName), "gi"), " ")
  )
}

function extractAudience(description: string) {
  for (const pattern of AUDIENCE_PATTERNS) {
    const match = description.match(pattern)

    if (match?.[0]) {
      return normalizeWhitespace(match[0])
    }
  }

  if (/\bbrand\b/i.test(description)) {
    return "brand teams"
  }

  if (/\bmarket/i.test(description)) {
    return "marketing teams"
  }

  return "teams"
}

function hasAiContext(value: string) {
  return /\b(ai|llm|chatgpt|gemini|perplexity|claude|answer engines?|answer engine|ai search|ai mode|ai overviews?)\b/i.test(
    value
  )
}

function extractAiSurfaces(value: string) {
  const surfaces = SURFACE_PATTERNS.flatMap(({ label, pattern }) =>
    pattern.test(value) ? [label] : []
  )

  if (surfaces.length > 0) {
    return surfaces
  }

  if (hasAiContext(value)) {
    return [...DEFAULT_AI_SURFACES]
  }

  return []
}

function joinWithAnd(values: string[]) {
  if (values.length <= 1) {
    return values[0] ?? ""
  }

  if (values.length === 2) {
    return `${values[0]} and ${values[1]}`
  }

  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`
}

function inferBusinessFocus(description: string) {
  if (/\bbrand visibility\b/i.test(description)) {
    return "brand visibility"
  }

  if (/\bcitations?\b/i.test(description)) {
    return "brand citations"
  }

  if (/\bshare of voice\b/i.test(description)) {
    return "share of voice"
  }

  if (/\bmonitor|track|measure\b/i.test(description)) {
    return "performance monitoring"
  }

  return "evaluation"
}

function classifyTopicIntent(topicName: string) {
  if (/\bcitation|mention|share of voice|sov\b/i.test(topicName)) {
    return "citations" satisfies TopicIntent
  }

  if (/\bprompt|query|question|alert|coverage|tracking\b/i.test(topicName)) {
    return "prompt_monitoring" satisfies TopicIntent
  }

  if (/\bcompetitor|benchmark|battlecard|market share\b/i.test(topicName)) {
    return "competitor_analysis" satisfies TopicIntent
  }

  if (/\boptimization|optimisation|geo|ai seo|llm seo|discoverability|ranking\b/i.test(
    topicName
  )) {
    return "optimization" satisfies TopicIntent
  }

  if (/\breport|reporting|dashboard|analytics|measurement|attribution\b/i.test(
    topicName
  )) {
    return "reporting" satisfies TopicIntent
  }

  if (
    /\bvisibility|ai search|answer engines?|llm|perplexity|chatgpt|gemini|google ai mode|ai overviews?\b/i.test(
      topicName
    )
  ) {
    return "visibility" satisfies TopicIntent
  }

  return "generic" satisfies TopicIntent
}

function formatTopicLabel(topicName: string) {
  return normalizeWhitespace(topicName)
}

function buildTopicPromptRecipe(input: {
  audience: string
  description: string
  topicName: string
}) {
  const intent = classifyTopicIntent(input.topicName)
  const aiSurfaces = extractAiSurfaces(`${input.description} ${input.topicName}`)
  const surfaceList = joinWithAnd(aiSurfaces)
  const businessFocus = inferBusinessFocus(input.description)

  const surfaceCategory = hasAiContext(`${input.description} ${input.topicName}`)
    ? "AI answers"
    : "buyer research"

  switch (intent) {
    case "visibility":
      return {
        comparisonFocus:
          "coverage across AI answers, citation tracking, and executive reporting",
        discoveryNeed: surfaceList
          ? `measuring brand visibility across ${surfaceList}`
          : "measuring brand visibility in buyer research journeys",
        solutionCategory: "AI visibility platforms",
      } satisfies TopicPromptRecipe
    case "citations":
      return {
        comparisonFocus:
          "citation tracking, mention accuracy, and trend reporting",
        discoveryNeed: surfaceList
          ? `tracking brand mentions and citation share across ${surfaceList}`
          : "tracking brand mentions and citation share",
        solutionCategory: "citation tracking platforms",
      } satisfies TopicPromptRecipe
    case "prompt_monitoring":
      return {
        comparisonFocus:
          "prompt coverage, alerting, and ranking change detection",
        discoveryNeed: `monitoring prompt coverage and ranking changes across ${surfaceCategory}`,
        solutionCategory: "prompt monitoring platforms",
      } satisfies TopicPromptRecipe
    case "competitor_analysis":
      return {
        comparisonFocus:
          "competitive benchmarking, share-of-voice analysis, and reporting",
        discoveryNeed: `benchmarking competitor share of voice and visibility across ${surfaceCategory}`,
        solutionCategory: "competitive intelligence platforms",
      } satisfies TopicPromptRecipe
    case "optimization":
      return {
        comparisonFocus:
          "recommendations, page-level insights, and optimization workflows",
        discoveryNeed: `improving discoverability and performance across ${surfaceCategory}`,
        solutionCategory: "LLM optimization platforms",
      } satisfies TopicPromptRecipe
    case "reporting":
      return {
        comparisonFocus:
          "dashboards, executive reporting, and historical trend analysis",
        discoveryNeed: `reporting on ${businessFocus} across ${surfaceCategory}`,
        solutionCategory: "AI reporting platforms",
      } satisfies TopicPromptRecipe
    case "generic":
      return {
        comparisonFocus: `${formatTopicLabel(input.topicName)}, workflow depth, and reporting`,
        discoveryNeed: `solving ${formatTopicLabel(input.topicName)} for ${input.audience}`,
        solutionCategory: "software platforms",
      } satisfies TopicPromptRecipe
  }
}

function buildCompetitorList(competitors: string[]) {
  const normalizedCompetitors = competitors.filter(Boolean).slice(0, 2)

  if (normalizedCompetitors.length === 0) {
    return "leading competitors"
  }

  return joinWithAnd(normalizedCompetitors)
}

export function buildTopicPromptPair(input: {
  companyName: string
  competitors: string[]
  description: string
  topicIndex?: number
  topicName: string
}) {
  const sanitizedDescription = removeCompanyName(input.description, input.companyName)
  const audience = extractAudience(sanitizedDescription)
  const recipe = buildTopicPromptRecipe({
    audience,
    description: sanitizedDescription,
    topicName: input.topicName,
  })
  const companyName = normalizeCompanyName(input.companyName)
  const competitors = buildCompetitorList(input.competitors)
  const discoveryVariants = [
    `Which platforms are best for ${recipe.discoveryNeed} for ${audience}?`,
    `What platforms help ${audience} with ${recipe.discoveryNeed}?`,
    `Which software do ${audience} trust for ${recipe.discoveryNeed}?`,
  ]
  const comparisonVariants = [
    `For ${audience} evaluating ${recipe.solutionCategory}, how does ${companyName} compare with ${competitors} on ${recipe.comparisonFocus}?`,
    `How does ${companyName} stack up against ${competitors} for ${recipe.comparisonFocus}?`,
    `Which platform is stronger for teams that need ${recipe.comparisonFocus}: ${companyName} or ${competitors}?`,
  ]
  const variantIndex = (input.topicIndex ?? 0) % discoveryVariants.length

  return {
    comparisonPrompt: normalizeWhitespace(comparisonVariants[variantIndex] ?? comparisonVariants[0] ?? ""),
    discoveryPrompt: normalizeWhitespace(discoveryVariants[variantIndex] ?? discoveryVariants[0] ?? ""),
  }
}
