import { NextResponse } from "next/server"

import {
  authenticateOnboardingRequest,
  buildFallbackOnboardingSuggestions,
  createEmptyOnboardingBrandResponse,
  mergeOnboardingWarnings,
  normalizeBrandOnboarding,
  onboardingBrandRequestSchema,
  scrapeBrandHomepage,
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

  const warnings: string[] = []
  let scrapeContext = null

  try {
    scrapeContext = await scrapeBrandHomepage(parsed.data.website)
  } catch (error) {
    warnings.push(
      toMessage(
        error,
        "We could not inspect your homepage, so the next steps will remain manual."
      )
    )
  }

  if (!scrapeContext) {
    return NextResponse.json(createEmptyOnboardingBrandResponse(warnings))
  }

  try {
    const suggestions = await normalizeBrandOnboarding({
      ...parsed.data,
      context: scrapeContext,
    })

    console.log("[onboarding] Route suggestions", suggestions)

    return NextResponse.json(mergeOnboardingWarnings(warnings, suggestions))
  } catch (error) {
    console.error("[onboarding] Normalization failed", error)

    warnings.push(
      toMessage(
        error,
        "We could not fully normalize your homepage, so we applied a lighter fallback."
      )
    )

    const fallback = buildFallbackOnboardingSuggestions(
      scrapeContext,
      parsed.data.website
    )

    console.log("[onboarding] Route fallback suggestions", fallback)

    return NextResponse.json(mergeOnboardingWarnings(warnings, fallback))
  }
}
