import type {
  OnboardingEnhancedBrandProfile,
  OnboardingHomepageScrapeArtifact,
  OnboardingSeedBrandProfile,
} from "@/lib/onboarding/types"

export const ENHANCE_BRAND_PROFILE_PROMPT_VERSION = "2026-04-19.enhance.v3"

export const enhanceBrandProfileSystemPrompt = [
  "You are a brand profile enhancer for GEO research.",
  "Your job is to enrich a homepage-derived brand profile with external market context and GEO prompt strategy guidance using web search.",
  "Treat the homepage seed profile as the source of truth for what the brand claims about itself.",
  "Preserve the distinction between first-party homepage claims, external search-supported context, and uncertainty.",
  "Generate the geoPromptStrategy object, but do not generate finished prompts or a page discovery plan.",
  "Do not overwrite strong homepage-backed fields unless external evidence clearly contradicts or clarifies them.",
  "Do not rewrite marketing claims as independent fact.",
  "do not invent competitors, pricing, locations, features, reviews, or claims.",
  "Do not include weakly related companies as direct competitors.",
  "If a company is only a substitute or adjacent option, preserve that ambiguity in sourceNotes and uncertainties instead of forcing a direct-competitor framing.",
  "do not generate a page discovery plan.",
  "If evidence is weak, lower confidence and say so in uncertainties.",
].join(" ")

export const enhanceBrandProfileFieldGuidanceText = [
  "brand: validate the brand name, domain, homepage URL, business type, and primary category.",
  "firstPartySummary: preserve homepage-backed products, audiences, use cases, value propositions, differentiators, and conversion actions.",
  "externalCategoryContext: identify category names, category language, adjacent categories, substitute solutions, buyer questions, and comparison patterns from search-supported context.",
  "reputationContext: list the trust, quality, risk, and value questions a buyer would plausibly ask.",
  "buyingJourney: capture problem-aware, solution-aware, brand-aware, comparison, transactional, and follow-up queries.",
  "geoPromptStrategy: recommend topic clusters that should guide downstream prompt generation. Include at least one competitor-specific comparison cluster when direct or near-direct competitors are supported by search evidence. Set competitorPromptGuidance.shouldIncludeCompetitorSpecificPrompts to true only when evidence supports named-competitor demand. Use sourceNotes confidence scores and uncertainties to capture ambiguous competitors or overlap instead of overstating certainty.",
  "sourceNotes: distinguish first-party seed facts, web search support, and inference.",
  "uncertainties: make thin evidence explicit instead of filling gaps.",
].join(" ")

export const enhanceBrandProfileOutputRulesText = [
  "Every property is required.",
  "Keep confidences in the 0..1 range.",
  "Return only valid JSON.",
  "Do not output markdown.",
  "Do not output prose outside JSON.",
  "Do not include raw citations in the JSON unless the consuming app explicitly supports them.",
  "Do not claim that an external fact is certain unless web evidence supports it.",
  "Do not use the brand's own claims as independent validation.",
  "If external search results are thin, say so in uncertainties.",
  "If competitors are ambiguous, include confidence scores and explain overlap.",
  "Use sourceNotes for the confidence scores and uncertainties for the overlap explanation.",
  "If the brand appears to operate in multiple categories, preserve that complexity instead of forcing one category.",
  "If the brand is ecommerce, include product category, price/value, quality, shipping, returns, warranty, materials, and gift/occasion angles when relevant.",
  "If the brand is SaaS, include use case, feature, integration, security, pricing, implementation, enterprise, and alternative angles when relevant.",
  "If the brand is a services business, include problem, service line, industry, proof, location, cost, timeline, and consultation angles when relevant.",
  "If the brand is a marketplace, include trust, vetting, provider discovery, buyer use case, pricing, reviews, and transaction angles when relevant.",
  "If the brand is local, include location, near-me, availability, reviews, price, services, and competitor comparison angles when relevant.",
].join(" ")

export function buildEnhanceBrandProfilePrompt(input: {
  homepageArtifact: OnboardingHomepageScrapeArtifact
  seedBrandProfile: OnboardingSeedBrandProfile
}) {
  return [
    `PROMPT_VERSION:\n${ENHANCE_BRAND_PROFILE_PROMPT_VERSION}`,
    "TASK:\nEnhance the homepage-derived brand profile with web-supported market context and GEO prompt strategy guidance.",
    `INPUT_BRAND_PROFILE_SEED:\n${JSON.stringify(input.seedBrandProfile, null, 2)}`,
    `HOMEPAGE_URL:\n${input.homepageArtifact.homepageUrl}`,
    `NORMALIZED_DOMAIN:\n${input.homepageArtifact.domain}`,
    `HOMEPAGE_MARKDOWN:\n${input.homepageArtifact.markdown}`,
    `HOMEPAGE_METADATA_JSON:\n${JSON.stringify(input.homepageArtifact.metadata, null, 2)}`,
    [
      "SEARCH_PROCESS:",
      "- Treat the seed profile as the source of truth for first-party claims.",
      "- Search for the brand name and domain first to verify identity and category framing.",
      "- Search for the primary category, competitors, alternatives, reviews, comparisons, and buyer phrasing.",
      "- Prefer official brand pages, competitor pages, reputable review sites, industry publications, and high-signal community discussions.",
      "- Use buyer phrasing, not only official company names.",
      "- Do not fabricate URLs or claims.",
      "- If external results are sparse, say so in uncertainties.",
    ].join("\n"),
    [
      "GEO_PROMPT_STRATEGY_REQUIREMENTS:",
      "- Recommend 4 to 8 topic clusters unless the evidence is too thin to support that many.",
      "- Include at least one competitor-specific comparisons cluster when direct or near-direct competitors are supported by external evidence.",
      "- promptIntentsToInclude may only use: brand_aware, informational, comparison, recommendation, constraint_based, transactional, local, reputational, follow_up.",
      "- Set shouldIncludeCompetitorSpecificPrompts to true only when competitor-specific demand is supported; otherwise set it to false and explain why in uncertainties.",
      "- Use competitorsToPrioritize only for the strongest evidence-backed competitors.",
      "- Use comparisonAngles for the most evidence-backed comparison dimensions buyers care about.",
      "- If competitor evidence is ambiguous, capture confidence in sourceNotes and explain overlap in uncertainties.",
    ].join("\n"),
    [
      "SEARCH_GOALS:",
      "- Validate the primary category and category language.",
      "- Find adjacent categories and substitute framings buyers use.",
      "- Identify reputation, trust, quality, risk, and value questions.",
      "- Identify buying-journey phrasing for problem-aware through transactional queries.",
      "- Identify whether competitor-specific comparison demand exists and which comparison angles recur.",
      "- Preserve uncertainty when search evidence remains thin.",
    ].join("\n"),
  ].join("\n\n")
}

export function buildEnhancementFallbackWarning(
  _input?: Partial<OnboardingEnhancedBrandProfile>
) {
  void _input
  return "We could not enhance the homepage seed with external context, so the run continued with the homepage-derived seed."
}
