import { NextResponse } from "next/server"

import {
  authenticateOnboardingRequest,
  completeOnboardingRequestSchema,
  completeOnboardingSetup,
  createAuthenticatedOnboardingClient,
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = completeOnboardingRequestSchema.safeParse(body)

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body."

    return createErrorResponse(message, 400)
  }

  const authorization = request.headers.get("Authorization")
  const user = await authenticateOnboardingRequest(authorization)

  if (!user) {
    return createErrorResponse("You must be signed in to continue.", 401)
  }

  try {
    const client = createAuthenticatedOnboardingClient(authorization)
    const brand = await completeOnboardingSetup(client, parsed.data)

    return NextResponse.json(brand)
  } catch (error) {
    console.error("[onboarding] Completion failed", error)

    return createErrorResponse(
      error instanceof Error
        ? error.message
        : "Unable to complete onboarding.",
      500
    )
  }
}
