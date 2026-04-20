import { NextResponse } from "next/server"

import {
  authenticatePromptPipelineRequest,
  createAuthenticatedPromptPipelineClient,
  loadPromptRunChatPayload,
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

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      promptRunId: string
    }>
  }
) {
  const authorization = request.headers.get("Authorization")
  const user = await authenticatePromptPipelineRequest(authorization)

  if (!user) {
    return createErrorResponse("You must be signed in to continue.", 401)
  }

  try {
    const { promptRunId } = await context.params
    const client = createAuthenticatedPromptPipelineClient(authorization)
    const payload = await loadPromptRunChatPayload(client, promptRunId)

    if (!payload) {
      return createErrorResponse("Prompt run not found.", 404)
    }

    return NextResponse.json(payload)
  } catch (error) {
    return createErrorResponse(
      error instanceof Error
        ? error.message
        : "Unable to load the prompt run replay.",
      500
    )
  }
}
