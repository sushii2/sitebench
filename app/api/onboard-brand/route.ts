import { NextResponse } from "next/server"

import {
  authenticateOnboardingRequest,
  generateCompatibilityOnboardingSuggestions,
  onboardingBrandRequestSchema,
} from "@/lib/onboarding"

function createErrorResponse(message: string, status: number) {
  return NextResponse.json(
    {
      error: {
        message,
      },
    },
    { status }
  )
}

function toMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = onboardingBrandRequestSchema.safeParse(body)

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body."

    return createErrorResponse(message, 400)
  }

  const user = await authenticateOnboardingRequest(
    request.headers.get("Authorization")
  )

  if (!user) {
    return createErrorResponse("You must be signed in to continue.", 401)
  }

  try {
    const suggestions = await generateCompatibilityOnboardingSuggestions(parsed.data)

    return NextResponse.json(suggestions)
  } catch (error) {
    console.error("[onboarding] Compatibility route failed", error)

    return createErrorResponse(
      toMessage(error, "Unable to generate onboarding suggestions."),
      502
    )
  }
}
