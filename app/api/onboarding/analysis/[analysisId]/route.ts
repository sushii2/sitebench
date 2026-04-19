import { NextResponse } from "next/server"

import {
  authenticateOnboardingRequest,
  createAuthenticatedOnboardingClient,
  loadOnboardingAnalysisRunStatus,
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

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      analysisId: string
    }>
  }
) {
  const authorization = request.headers.get("Authorization")
  const user = await authenticateOnboardingRequest(authorization)

  if (!user) {
    return createErrorResponse("You must be signed in to continue.", 401)
  }

  const { analysisId } = await context.params

  if (!analysisId?.trim()) {
    return createErrorResponse("Analysis ID is required.", 400)
  }

  try {
    logOnboardingAnalysisEvent("Analysis poll route accepted request", {
      analysisId,
      userId: user.id,
    })

    const client = createAuthenticatedOnboardingClient(authorization)
    const analysis = await loadOnboardingAnalysisRunStatus(client, analysisId)

    logOnboardingAnalysisEvent("Analysis poll route completed", {
      analysisId,
      status: analysis.status,
    })

    return NextResponse.json(analysis)
  } catch (error) {
    logOnboardingAnalysisError("Analysis poll failed", error, {
      analysisId,
    })

    return createErrorResponse(
      error instanceof Error
        ? error.message
        : "Unable to load onboarding analysis.",
      500
    )
  }
}
