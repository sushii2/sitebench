import type { InsForgeClient } from "@insforge/sdk"

import type { OnboardingPromptDraft } from "@/lib/onboarding/types"
import type { PromptCatalog } from "@/lib/prompt-catalog/types"

type PromptCatalogClient = Pick<InsForgeClient, "database">

function takeRows<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

function normalizeTemplateText(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function normalizePromptText(value: string) {
  return normalizeTemplateText(value).toLowerCase()
}

async function loadPromptCatalogByNormalizedPrompt(
  client: PromptCatalogClient,
  normalizedPrompt: string
) {
  const response = await client.database
    .from("prompt_catalog")
    .select("*")
    .eq("normalized_prompt", normalizedPrompt)

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load prompt catalog entries.")
  }

  return takeRows(response.data as PromptCatalog[] | PromptCatalog | null)[0] ?? null
}

export async function resolvePromptCatalogId(
  client: PromptCatalogClient,
  prompt: Pick<OnboardingPromptDraft, "templateText" | "variantType">,
  cache?: Map<string, string | null>
) {
  if (!prompt.templateText?.trim()) {
    return null
  }

  const promptText = normalizeTemplateText(prompt.templateText)
  const normalizedPrompt = normalizePromptText(promptText)
  const cachedValue = cache?.get(normalizedPrompt)

  if (cachedValue !== undefined) {
    return cachedValue
  }

  const existing = await loadPromptCatalogByNormalizedPrompt(
    client,
    normalizedPrompt
  )

  if (existing) {
    cache?.set(normalizedPrompt, existing.id)
    return existing.id
  }

  cache?.set(normalizedPrompt, null)
  return null
}
