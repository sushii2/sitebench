import { normalizeCompanyName, parsePublicWebsiteUrl } from "@/lib/brands"
import type {
  OnboardingBrandProfile,
  OnboardingCompetitor,
  OnboardingPromptGenerationCandidate,
  OnboardingTopicInput,
} from "@/lib/onboarding/types"

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

export function normalizePromptEntityName(value: string) {
  const normalized = normalizeWhitespace(value)

  if (!normalized) {
    return ""
  }

  try {
    return normalizeCompanyName(normalized)
  } catch {
    const url = parsePublicWebsiteUrl(normalized)

    if (!url) {
      return normalized
    }

    return url.hostname.replace(/^www\./i, "").split(".")[0] ?? normalized
  }
}

function inferPersona(brandProfile: OnboardingBrandProfile) {
  return (
    brandProfile.targetCustomers[0] ??
    (brandProfile.siteArchetype === "ecommerce"
      ? "shopper"
      : "buyer evaluating vendors")
  )
}

function inferConstraint(brandProfile: OnboardingBrandProfile) {
  if (brandProfile.siteArchetype === "ecommerce") {
    return "need strong value, fit, and delivery confidence"
  }

  if (/\bintegration|demo-led|enterprise\b/i.test(brandProfile.pricing)) {
    return "need low implementation risk and clear buying justification"
  }

  return "need confidence before switching or purchasing"
}

function buildContext(brandProfile: OnboardingBrandProfile) {
  const geography = brandProfile.geography ? ` in ${brandProfile.geography}` : ""
  const productContext =
    brandProfile.products.length > 0
      ? ` across ${brandProfile.products.slice(0, 3).join(", ")}`
      : ""

  return `${brandProfile.detailedDescription}${geography}${productContext}`.trim()
}

function buildComparisonPrompt(
  brandProfile: OnboardingBrandProfile,
  companyName: string,
  competitors: OnboardingCompetitor[],
  category: string,
  persona: string,
  constraint: string
) {
  const competitorList = competitors
    .slice(0, 2)
    .map((competitor) => normalizePromptEntityName(competitor.name))
    .join(" and ")

  return competitorList
    ? `How should ${persona} compare ${normalizePromptEntityName(companyName)} and ${competitorList} for ${category} when they ${constraint}?`
    : `How should ${persona} compare ${category} options when they ${constraint}?`
}

function buildEcommerceTemplates(input: {
  brandProfile: OnboardingBrandProfile
  companyName: string
  competitors: OnboardingCompetitor[]
  topic: OnboardingTopicInput
}): OnboardingPromptGenerationCandidate[] {
  const persona = inferPersona(input.brandProfile)
  const category =
    input.topic.topicName || input.brandProfile.primarySubcategory || input.brandProfile.primaryCategory
  const constraint = "need the right fit, price point, and quality tradeoffs"
  const context = buildContext(input.brandProfile)

  return [
    {
      category,
      constraint,
      context,
      goal: "discover reputable options",
      persona,
      promptText: `What are the best ${category} for a ${persona} who needs the right fit, price point, and quality tradeoffs?`,
      variantType: "discovery",
    },
    {
      category,
      constraint: "want to compare price, material, and fit before buying",
      context,
      goal: "compare shortlisted brands",
      persona,
      promptText: buildComparisonPrompt(
        input.brandProfile,
        input.companyName,
        input.competitors,
        category,
        persona,
        "want to compare price, material, and fit before buying"
      ),
      variantType: "comparison",
    },
  ]
}

function buildSaasTemplates(input: {
  brandProfile: OnboardingBrandProfile
  companyName: string
  competitors: OnboardingCompetitor[]
  topic: OnboardingTopicInput
}): OnboardingPromptGenerationCandidate[] {
  const persona = inferPersona(input.brandProfile)
  const category =
    input.topic.topicName || input.brandProfile.primarySubcategory || input.brandProfile.primaryCategory
  const constraint = inferConstraint(input.brandProfile)
  const context = buildContext(input.brandProfile)

  return [
    {
      category,
      constraint,
      context,
      goal: "build a shortlist",
      persona,
      promptText: `What ${category} options should ${persona} shortlist when they ${constraint}?`,
      variantType: "discovery",
    },
    {
      category,
      constraint,
      context,
      goal: "compare leading vendors",
      persona,
      promptText: buildComparisonPrompt(
        input.brandProfile,
        input.companyName,
        input.competitors,
        category,
        persona,
        constraint
      ),
      variantType: "comparison",
    },
  ]
}

export function buildDeterministicPromptTemplates(input: {
  brandProfile: OnboardingBrandProfile
  companyName: string
  competitors: OnboardingCompetitor[]
  topic: OnboardingTopicInput
}): OnboardingPromptGenerationCandidate[] {
  if (input.brandProfile.siteArchetype === "ecommerce") {
    return buildEcommerceTemplates(input)
  }

  return buildSaasTemplates(input)
}
