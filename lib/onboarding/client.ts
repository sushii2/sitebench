import { getInsforgeBrowserClient } from "@/lib/insforge/browser-client"
import {
  completeOnboardingRequestSchema,
  onboardingBrandRequestSchema,
  onboardingBrandResponseSchema,
  onboardingTopicPromptRequestSchema,
  onboardingTopicPromptResponseSchema,
  type CompleteOnboardingRequest,
  type OnboardingBrandRequest,
  type OnboardingTopicPromptRequest,
} from "@/lib/onboarding/types"

function getAuthorizationHeader() {
  const headers = getInsforgeBrowserClient().getHttpClient().getHeaders()

  return headers.Authorization ?? headers.authorization ?? null
}

export async function fetchOnboardingBrandSuggestions(
  input: OnboardingBrandRequest
) {
  const payload = onboardingBrandRequestSchema.parse(input)
  const authorization = getAuthorizationHeader()

  if (!authorization) {
    throw new Error("You must be signed in to generate onboarding suggestions.")
  }

  const response = await fetch("/api/onboard-brand", {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      typeof data?.error?.message === "string"
        ? data.error.message
        : "Unable to generate onboarding suggestions."

    throw new Error(message)
  }

  return onboardingBrandResponseSchema.parse(data)
}

export async function fetchOnboardingTopicPrompts(
  input: OnboardingTopicPromptRequest
) {
  const payload = onboardingTopicPromptRequestSchema.parse(input)
  const authorization = getAuthorizationHeader()

  if (!authorization) {
    throw new Error("You must be signed in to generate onboarding prompts.")
  }

  const response = await fetch("/api/onboarding/topic-prompts", {
    body: JSON.stringify(payload),
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    method: "POST",
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      typeof data?.error?.message === "string"
        ? data.error.message
        : "Unable to generate onboarding prompts."

    throw new Error(message)
  }

  return onboardingTopicPromptResponseSchema.parse(data)
}

export async function completeOnboarding(input: CompleteOnboardingRequest) {
  const payload = completeOnboardingRequestSchema.parse(input)
  const authorization = getAuthorizationHeader()

  if (!authorization) {
    throw new Error("You must be signed in to complete onboarding.")
  }

  const response = await fetch("/api/onboarding/complete", {
    body: JSON.stringify(payload),
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    method: "POST",
  })

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      typeof data?.error?.message === "string"
        ? data.error.message
        : "Unable to complete onboarding."

    throw new Error(message)
  }

  return data
}
