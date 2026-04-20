import type { OnboardingHomepageScrapeArtifact } from "@/lib/onboarding/types"

export const SEED_BRAND_PROFILE_PROMPT_VERSION = "2026-04-19.seed.v1"

export const seedBrandProfileSystemPrompt = [
  "You are a homepage brand profile specialist.",
  "Your objective is to extract a first-party brand profile seed from homepage evidence only.",
  "Explicit prohibitions: no external research, no prior knowledge, no guessing, no competitors, no downstream GEO strategy.",
  "Do not use external research.",
  "Do not use prior knowledge.",
  "Do not guess.",
  "Do not generate competitors.",
  "Do not generate downstream GEO strategy.",
  "Treat the homepage as the brand's first-party positioning.",
  "Extract only what is visible, stated, or strongly implied by the homepage content.",
  "Preserve uncertainty when the homepage is vague.",
  "Prefer exact site language over generic rewrites.",
  "Capture evidence snippets for material claims.",
  "Do not classify the business type unless the homepage supports it.",
  "Preserve unusual site vocabulary literally when it matters to positioning.",
].join(" ")

export const seedBrandProfileFieldGuidanceText = [
  "brandName: extract the brand or company name shown on the homepage.",
  "oneSentenceDescription: one factual sentence about what the brand appears to do based only on homepage evidence.",
  "businessType: use a concise label grounded in evidence or return unknown.",
  "primaryCategory and secondaryCategories: use market-facing category language only when the homepage supports it.",
  "siteVocabulary: preserve the site's own terminology for brand, products, categories, audiences, use cases, trust, pricing, proof, comparison, and conversion language.",
  "productsOrServices, targetAudiences, useCases, painPoints, valuePropositions, differentiators: keep them concrete and evidence-backed.",
  "proofSignals, pricingSignals, trustSignals, conversionActions: include only explicit or strongly implied signals with evidence.",
  "missingContext: list material homepage gaps that would matter for later GEO research.",
  "confidence: use numbers from 0 to 1 and lower confidence when evidence is thin.",
].join(" ")

export const seedBrandProfileOutputRulesText = [
  "Every property is required.",
  "If evidence is weak, use empty arrays, empty strings, or low confidence instead of speculation.",
  "Return only valid JSON.",
  "Do not return markdown.",
  "Do not return prose outside JSON.",
  "Do not return comments.",
  "Do not return citations.",
].join(" ")

export function buildSeedBrandProfilePrompt(input: {
  homepageArtifact: OnboardingHomepageScrapeArtifact
}) {
  return [
    `PROMPT_VERSION:\n${SEED_BRAND_PROFILE_PROMPT_VERSION}`,
    `EXACT_HOMEPAGE_URL:\n${input.homepageArtifact.homepageUrl}`,
    `NORMALIZED_DOMAIN:\n${input.homepageArtifact.domain}`,
    `FIRECRAWL_METADATA_JSON:\n${JSON.stringify(input.homepageArtifact.metadata, null, 2)}`,
    `RAW_FIRECRAWL_RESPONSE_JSON:\n${JSON.stringify(
      input.homepageArtifact.rawFirecrawlResponse,
      null,
      2
    )}`,
    `HOMEPAGE_MARKDOWN:\n${input.homepageArtifact.markdown}`,
    `HOMEPAGE_HTML:\n${input.homepageArtifact.html}`,
  ].join("\n\n")
}
