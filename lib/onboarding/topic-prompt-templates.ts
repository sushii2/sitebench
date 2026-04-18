import { normalizeCompanyName, parsePublicWebsiteUrl } from "@/lib/brands"

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
  contextualThemes: string[]
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

const GENERIC_TOPIC_PATTERNS = [
  /\bfeature evaluation\b/i,
  /\bbuyer (evaluation|discovery|research)\b/i,
  /\bcompetitor analysis\b/i,
  /\bcomparison\b/i,
  /\breporting\b/i,
  /\bmonitoring\b/i,
  /\boptimization\b/i,
  /\bprompt research\b/i,
  /\bgeneric\b/i,
] as const

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function removeCompanyName(value: string, companyName: string) {
  const normalizedCompanyName = normalizePromptEntityName(companyName)

  return normalizeWhitespace(
    value.replace(new RegExp(escapeRegExp(normalizedCompanyName), "gi"), " ")
  )
}

function toPromptDomainLabel(value: string) {
  const url = parsePublicWebsiteUrl(value)

  if (!url) {
    return null
  }

  const hostname = url.hostname.replace(/^www\./i, "")
  const firstLabel = hostname.split(".")[0]?.trim()

  if (!firstLabel) {
    return null
  }

  return toTitleCase(firstLabel.replace(/[-_]+/g, " "))
}

export function normalizePromptEntityName(value: string) {
  const normalized = normalizeWhitespace(value)

  if (!normalized) {
    return ""
  }

  try {
    return normalizeCompanyName(normalized)
  } catch {
    return toPromptDomainLabel(normalized) ?? normalized
  }
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

const SOURCE_URL_STOPWORDS = new Set([
  "aeo",
  "ai",
  "alternatives",
  "blog",
  "compare",
  "comparison",
  "contact",
  "customers",
  "engineering",
  "enterprise",
  "feature",
  "features",
  "for",
  "home",
  "index",
  "insights",
  "integrations",
  "platform",
  "pricing",
  "product",
  "products",
  "resources",
  "research",
  "solutions",
  "teams",
  "the",
  "vs",
])

function toTitleCase(value: string) {
  return value.replace(/\b\w/g, (character) => character.toUpperCase())
}

function extractIntentSummaryThemes(intentSummary?: string) {
  if (!intentSummary) {
    return []
  }

  const cleaned = normalizeWhitespace(
    intentSummary
      .replace(/^buyer\s+(evaluation|discovery|research|comparison)\s+of\s+/i, "")
      .replace(/^evaluation\s+of\s+/i, "")
      .replace(/\bfor\s+.+$/i, "")
      .replace(/\bused by\s+.+$/i, "")
  )

  if (!cleaned) {
    return []
  }

  return cleaned
    .split(/\s*(?:,| and )\s*/i)
    .map((value) =>
      normalizeWhitespace(value.replace(/^and\s+/i, ""))
    )
    .filter((value) => value.length >= 4)
}

function extractSourceUrlThemes(sourceUrls: string[]) {
  const phrases: string[] = []

  for (const value of sourceUrls) {
    let pathname = value

    try {
      pathname = new URL(value).pathname
    } catch {
      pathname = value
    }

    const segments = pathname
      .split("/")
      .map((segment) => decodeURIComponent(segment).toLowerCase())
      .filter(Boolean)

    for (const segment of segments) {
      const words = segment
        .split(/[-_]+/)
        .map((word) => word.trim())
        .filter(
          (word) => word.length >= 3 && !SOURCE_URL_STOPWORDS.has(word)
        )

      if (words.length === 0) {
        continue
      }

      phrases.push(toTitleCase(words.join(" ")))
    }
  }

  return [...new Set(phrases)]
}

function buildContextualThemes(input: {
  intentSummary?: string
  sourceUrls?: string[]
}) {
  return [
    ...extractIntentSummaryThemes(input.intentSummary),
    ...extractSourceUrlThemes(input.sourceUrls ?? []),
  ].filter((value, index, values) => values.indexOf(value) === index)
}

function joinThemes(values: string[]) {
  const cleaned = values.map((value) => normalizeWhitespace(value)).filter(Boolean)

  return joinWithAnd(cleaned)
}

function formatTopicLabel(topicName: string) {
  return normalizeWhitespace(topicName)
}

function isGenericTopicName(topicName: string) {
  return GENERIC_TOPIC_PATTERNS.some((pattern) => pattern.test(topicName))
}

function buildFallbackTopicLabel(intent: TopicIntent) {
  switch (intent) {
    case "visibility":
      return "ai visibility and answer engine rankings"
    case "citations":
      return "brand citations and mention tracking"
    case "prompt_monitoring":
      return "monitoring prompts and ranking changes"
    case "competitor_analysis":
      return "ai visibility tool comparisons"
    case "optimization":
      return "improving visibility in chatgpt and perplexity"
    case "reporting":
      return "reporting on ai visibility performance"
    case "generic":
      return "ai visibility research"
  }
}

function buildTopicPromptRecipe(input: {
  audience: string
  description: string
  intentSummary?: string
  sourceUrls?: string[]
  topicName: string
}) {
  const contextualThemes = buildContextualThemes({
    intentSummary: input.intentSummary,
    sourceUrls: input.sourceUrls,
  })
  const classificationContext = [
    input.topicName,
    input.intentSummary ?? "",
    contextualThemes.join(" "),
  ].join(" ")
  const intent = classifyTopicIntent(classificationContext)
  const aiSurfaces = extractAiSurfaces(
    `${input.description} ${input.topicName} ${input.intentSummary ?? ""} ${contextualThemes.join(" ")}`
  )
  const surfaceList = joinWithAnd(aiSurfaces)
  const businessFocus = inferBusinessFocus(input.description)
  const contextualThemeLabel = joinThemes(contextualThemes.slice(0, 3))
  const mixedAiEvaluationCategory =
    contextualThemes.length > 1 && hasAiContext(classificationContext)
      ? "AI visibility and brand intelligence platforms"
      : null

  const surfaceCategory = hasAiContext(`${input.description} ${input.topicName}`)
    ? "AI answers"
    : "buyer research"

  switch (intent) {
    case "visibility":
      return {
        comparisonFocus:
          contextualThemeLabel
            ? `${contextualThemeLabel}, citation tracking, and executive reporting`
            : "coverage across AI answers, citation tracking, and executive reporting",
        contextualThemes,
        discoveryNeed: surfaceList
          ? contextualThemeLabel
            ? `measuring ${contextualThemeLabel} across ${surfaceList}`
            : `measuring brand visibility across ${surfaceList}`
          : "measuring brand visibility in buyer research journeys",
        solutionCategory: "AI visibility tools",
      } satisfies TopicPromptRecipe
    case "citations":
      return {
        comparisonFocus:
          contextualThemeLabel
            ? `${contextualThemeLabel}, mention accuracy, and trend reporting`
            : "citation tracking, mention accuracy, and trend reporting",
        contextualThemes,
        discoveryNeed: surfaceList
          ? contextualThemeLabel
            ? `tracking ${contextualThemeLabel} across ${surfaceList}`
            : `tracking brand mentions and citation share across ${surfaceList}`
          : "tracking brand mentions and citation share",
        solutionCategory:
          mixedAiEvaluationCategory ?? "citation tracking tools",
      } satisfies TopicPromptRecipe
    case "prompt_monitoring":
      return {
        comparisonFocus:
          contextualThemeLabel
            ? `${contextualThemeLabel}, alerting, and ranking change detection`
            : "prompt coverage, alerting, and ranking change detection",
        contextualThemes,
        discoveryNeed: contextualThemeLabel
          ? `monitoring ${contextualThemeLabel} across ${surfaceCategory}`
          : `monitoring prompt coverage and ranking changes across ${surfaceCategory}`,
        solutionCategory: "prompt monitoring tools",
      } satisfies TopicPromptRecipe
    case "competitor_analysis":
      return {
        comparisonFocus:
          contextualThemeLabel
            ? `${contextualThemeLabel}, share-of-voice analysis, and reporting`
            : "competitive benchmarking, share-of-voice analysis, and reporting",
        contextualThemes,
        discoveryNeed: contextualThemeLabel
          ? `benchmarking ${contextualThemeLabel} across ${surfaceCategory}`
          : `benchmarking competitor share of voice and visibility across ${surfaceCategory}`,
        solutionCategory: "competitive intelligence tools",
      } satisfies TopicPromptRecipe
    case "optimization":
      return {
        comparisonFocus:
          contextualThemeLabel
            ? `${contextualThemeLabel}, recommendations, and optimization workflows`
            : "recommendations, page-level insights, and optimization workflows",
        contextualThemes,
        discoveryNeed: contextualThemeLabel
          ? `improving ${contextualThemeLabel} across ${surfaceCategory}`
          : `improving discoverability and performance across ${surfaceCategory}`,
        solutionCategory: "LLM optimization tools",
      } satisfies TopicPromptRecipe
    case "reporting":
      return {
        comparisonFocus:
          contextualThemeLabel
            ? `${contextualThemeLabel}, executive reporting, and historical trend analysis`
            : "dashboards, executive reporting, and historical trend analysis",
        contextualThemes,
        discoveryNeed: contextualThemeLabel
          ? `reporting on ${contextualThemeLabel} across ${surfaceCategory}`
          : `reporting on ${businessFocus} across ${surfaceCategory}`,
        solutionCategory: "AI reporting tools",
      } satisfies TopicPromptRecipe
    case "generic":
      return {
        comparisonFocus: contextualThemeLabel
          ? `${contextualThemeLabel}, workflow depth, and reporting`
          : `${formatTopicLabel(input.topicName)}, workflow depth, and reporting`,
        contextualThemes,
        discoveryNeed: contextualThemeLabel
          ? `solving ${contextualThemeLabel} for ${input.audience}`
          : `solving ${formatTopicLabel(input.topicName)} for ${input.audience}`,
        solutionCategory: hasAiContext(classificationContext)
          ? "AI visibility and brand intelligence tools"
          : "software tools",
      } satisfies TopicPromptRecipe
  }
}

export function buildHumanTopicName(input: {
  description: string
  intentSummary?: string
  sourceUrls?: string[]
  topicName: string
}) {
  const contextualThemes = buildContextualThemes({
    intentSummary: input.intentSummary,
    sourceUrls: input.sourceUrls,
  }).map((value) => normalizeWhitespace(value).toLowerCase())
  const intent = classifyTopicIntent(
    [input.topicName, input.intentSummary ?? "", contextualThemes.join(" ")].join(" ")
  )
  const topicName = normalizeWhitespace(input.topicName).toLowerCase()

  if (!isGenericTopicName(topicName)) {
    return topicName
  }

  if (contextualThemes.length > 0) {
    return joinWithAnd(contextualThemes.slice(0, 3))
  }

  return buildFallbackTopicLabel(intent)
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
  intentSummary?: string
  sourceUrls?: string[]
  topicIndex?: number
  topicName: string
}) {
  const sanitizedDescription = removeCompanyName(input.description, input.companyName)
  const audience = extractAudience(sanitizedDescription)
  const recipe = buildTopicPromptRecipe({
    audience,
    description: sanitizedDescription,
    intentSummary: input.intentSummary,
    sourceUrls: input.sourceUrls,
    topicName: input.topicName,
  })
  const companyName = normalizePromptEntityName(input.companyName)
  const competitors = buildCompetitorList(input.competitors)
  const discoveryVariants = [
    `How do ${audience} handle ${recipe.discoveryNeed}?`,
    `What tools do ${audience} use for ${recipe.discoveryNeed}?`,
    `What are the best ways for ${audience} to tackle ${recipe.discoveryNeed}?`,
  ]
  const comparisonVariants = [
    `${companyName} vs ${competitors} for ${recipe.comparisonFocus}`,
    `How does ${companyName} compare with ${competitors} on ${recipe.comparisonFocus}?`,
    `Should we use ${companyName} or ${competitors} if we care most about ${recipe.comparisonFocus}?`,
  ]
  const variantIndex = (input.topicIndex ?? 0) % discoveryVariants.length

  return {
    comparisonPrompt: normalizeWhitespace(comparisonVariants[variantIndex] ?? comparisonVariants[0] ?? ""),
    discoveryPrompt: normalizeWhitespace(discoveryVariants[variantIndex] ?? discoveryVariants[0] ?? ""),
  }
}

export function buildTopicPromptVariants(input: {
  companyName: string
  competitors: string[]
  description: string
  intentSummary?: string
  sourceUrls: string[]
  topicIndex?: number
  topicName: string
}) {
  const sanitizedDescription = removeCompanyName(input.description, input.companyName)
  const audience = extractAudience(sanitizedDescription)
  const recipe = buildTopicPromptRecipe({
    audience,
    description: sanitizedDescription,
    intentSummary: input.intentSummary,
    sourceUrls: input.sourceUrls,
    topicName: input.topicName,
  })
  const companyName = normalizePromptEntityName(input.companyName)
  const discoveryPrompt = buildTopicPromptPair(input).discoveryPrompt
  const comparisonPrompt = buildTopicPromptPair(input).comparisonPrompt
  const contextualThemeLabel = joinThemes(recipe.contextualThemes.slice(0, 3))

  return [
    {
      templateText: "How do {audience} handle {discovery_need}?",
      variantType: "discovery" as const,
      promptText: discoveryPrompt,
      baseScore: 96,
    },
    {
      templateText:
        "{company} vs {competitor_list} for {comparison_focus}",
      variantType: "comparison" as const,
      promptText: comparisonPrompt,
      baseScore: 93,
    },
    {
      templateText:
        "What are the best {solution_category} for {audience} focused on {discovery_need}?",
      variantType: "alternatives" as const,
      promptText: normalizeWhitespace(
        `What are the best ${recipe.solutionCategory.toLowerCase()} for ${audience} focused on ${recipe.discoveryNeed}?`
      ),
      baseScore: 90,
    },
    {
      templateText:
        "How much do {solution_category} cost for {audience}?",
      variantType: "pricing" as const,
      promptText: normalizeWhitespace(
        contextualThemeLabel
          ? `How much do ${recipe.solutionCategory.toLowerCase()} cost for ${audience} that need ${contextualThemeLabel}?`
          : `How much do ${recipe.solutionCategory.toLowerCase()} cost for ${audience} that need ${recipe.discoveryNeed}?`
      ),
      baseScore: 87,
    },
    {
      templateText:
        "How are teams implementing {topic_name} across AI answers?",
      variantType: "implementation" as const,
      promptText: normalizeWhitespace(
        contextualThemeLabel
          ? `How are ${audience} implementing ${contextualThemeLabel} across ChatGPT, Gemini, and Perplexity without a lot of manual work?`
          : `How are ${audience} implementing ${recipe.discoveryNeed} across ChatGPT, Gemini, and Perplexity without a lot of manual work?`
      ),
      baseScore: 84,
    },
    {
      templateText:
        "Is {company} a good fit for teams that need {comparison_focus}?",
      variantType: "competitor_specific" as const,
      promptText: normalizeWhitespace(
        `Is ${companyName} a good fit for ${audience} that need ${recipe.comparisonFocus}?`
      ),
      baseScore: 81,
    },
  ]
}
