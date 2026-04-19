import { NextResponse } from "next/server"

import {
  assertOnboardingAnalysisTablesAvailable,
  authenticateOnboardingRequest,
  createAuthenticatedOnboardingClient,
  onboardingAnalysisRequestSchema,
  startOnboardingAnalysisRun,
} from "@/lib/onboarding"
import {
  logOnboardingAnalysisError,
  logOnboardingAnalysisEvent,
} from "@/lib/onboarding/analysis-logging"

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
  const parsed = onboardingAnalysisRequestSchema.safeParse(body)

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
    logOnboardingAnalysisEvent("Analysis start route accepted request", {
      projectId: parsed.data.projectId,
      userId: user.id,
      website: parsed.data.website,
    })

    await assertOnboardingAnalysisTablesAvailable(authorization)

    const client = createAuthenticatedOnboardingClient(authorization)
    const analysis = await startOnboardingAnalysisRun(
      client,
      parsed.data,
      authorization
    )

    logOnboardingAnalysisEvent("Analysis start route completed", {
      analysisId: analysis.analysisId,
      projectId: parsed.data.projectId,
      status: analysis.status,
    })

    return NextResponse.json(analysis)
  } catch (error) {
    logOnboardingAnalysisError("Analysis start failed", error, {
      projectId: parsed.data.projectId,
      website: parsed.data.website,
    })

    return createErrorResponse(
      error instanceof Error
        ? error.message
        : "Unable to start onboarding analysis.",
      500
    )
  }
}
