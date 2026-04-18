import { NextResponse } from "next/server"

import {
  authenticateOnboardingRequest,
  generateTopicPromptCollection,
  onboardingTopicPromptRequestSchema,
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
  const parsed = onboardingTopicPromptRequestSchema.safeParse(body)

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body."

    return createErrorResponse(message, 400)
  }

  const authorization = request.headers.get("Authorization")
  const user = await authenticateOnboardingRequest(authorization)

  if (!user) {
    return createErrorResponse("You must be signed in to continue.", 401)
  }

  console.log("[onboarding] Generating topic prompt drafts", {
    analysisRunId: parsed.data.analysisRunId,
    topicCount: parsed.data.topics.length,
    userId: user.id,
  })

  const result = await generateTopicPromptCollection(parsed.data)

  return NextResponse.json(result)
}
