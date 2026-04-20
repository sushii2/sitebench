import { NextResponse } from "next/server"

import {
  authenticatePromptPipelineRequest,
  createAuthenticatedPromptPipelineClient,
  startPromptPipelineQuickRun,
} from "@/lib/prompt-pipeline"

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
  const authorization = request.headers.get("Authorization")
  const user = await authenticatePromptPipelineRequest(authorization)

  if (!user) {
    return createErrorResponse("You must be signed in to continue.", 401)
  }

  try {
    const client = createAuthenticatedPromptPipelineClient(authorization)
    const result = await startPromptPipelineQuickRun(client, authorization)

    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to start the prompt pipeline quick run."

    return createErrorResponse(
      message,
      /queued or running/i.test(message) ? 409 : 500
    )
  }
}
