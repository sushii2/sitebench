import { getInsforgeBrowserClient } from "@/lib/insforge/browser-client"
import {
  onboardingBrandRequestSchema,
  onboardingBrandResponseSchema,
  type OnboardingBrandRequest,
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

