import type {
  BrandCompetitorInput,
  BrandDraftStepInput,
  BrandDraftStep1Input,
  BrandDraftStep2Input,
  BrandDraftStep3Input,
} from "@/lib/brands/types"
import {
  normalizeCompanyName,
  parsePublicWebsiteUrl,
  normalizeWebsite,
} from "@/lib/brands/validation"

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function isStep1Input(
  input: BrandDraftStepInput
): input is BrandDraftStep1Input {
  return "company_name" in input && "website" in input
}

function isStep2Input(
  input: BrandDraftStepInput
): input is BrandDraftStep2Input {
  return "description" in input
}

function isStep3Input(
  input: BrandDraftStepInput
): input is BrandDraftStep3Input {
  return "topics" in input
}

export { normalizeCompanyName, normalizeWebsite } from "@/lib/brands/validation"

export function normalizeBrandTopics(topics: string[]) {
  const normalized: string[] = []
  const seen = new Set<string>()

  for (const topic of topics) {
    const candidate = normalizeWhitespace(topic).toLowerCase()

    if (!candidate || seen.has(candidate)) {
      continue
    }

    seen.add(candidate)
    normalized.push(candidate)
  }

  return normalized
}

export function normalizeCompetitors(competitors: BrandCompetitorInput[]) {
  return competitors.map((competitor) => ({
    name: normalizeWhitespace(competitor.name),
    website: normalizeWebsite(competitor.website),
  }))
}

export function normalizeBrandNameKey(value: string) {
  return normalizeWhitespace(value).toLowerCase()
}

export function getWebsiteHost(value: string) {
  const normalizedWebsite = normalizeWebsite(value)
  const url = parsePublicWebsiteUrl(normalizedWebsite)

  if (!url) {
    throw new Error("Enter a valid website")
  }

  return url.hostname.toLowerCase()
}

export function normalizeBrandDraftStep(
  input: BrandDraftStepInput
): Partial<
  BrandDraftStep1Input & BrandDraftStep2Input & BrandDraftStep3Input
> {
  if (isStep1Input(input)) {
    return {
      company_name: normalizeCompanyName(input.company_name),
      website: normalizeWebsite(input.website),
    }
  }

  if (isStep2Input(input)) {
    return {
      description: input.description.trim(),
    }
  }

  if (isStep3Input(input)) {
    return {
      topics: normalizeBrandTopics(input.topics),
    }
  }

  throw new Error("Unsupported brand draft step.")
}

export function normalizeDescription(value: string) {
  return value.trim()
}
