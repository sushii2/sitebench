import { NextResponse } from "next/server"

import {
  authenticatePromptPipelineRequest,
  createAuthenticatedPromptPipelineClient,
  terminatePromptPipelineRun,
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

export async function DELETE(
  request: Request,
  context: {
    params: Promise<{
      pipelineRunId: string
    }>
  }
) {
  const authorization = request.headers.get("Authorization")
  const user = await authenticatePromptPipelineRequest(authorization)

  if (!user) {
    return createErrorResponse("You must be signed in to continue.", 401)
  }

  const { pipelineRunId } = await context.params

  if (!pipelineRunId?.trim()) {
    return createErrorResponse("Pipeline run ID is required.", 400)
  }

  try {
    const client = createAuthenticatedPromptPipelineClient(authorization)
    const result = await terminatePromptPipelineRun(
      client,
      pipelineRunId,
      authorization
    )

    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to terminate the prompt pipeline run."

    return createErrorResponse(
      message,
      /queued or running/i.test(message) ? 409 : 500
    )
  }
}
