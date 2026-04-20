import { NextResponse } from "next/server"

import { startDuePromptPipelineRuns } from "@/lib/prompt-pipeline"

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

export async function GET(request: Request) {
  const authorization = request.headers.get("Authorization")

  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return createErrorResponse("Unauthorized", 401)
  }

  try {
    const result = await startDuePromptPipelineRuns()

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(
      error instanceof Error
        ? error.message
        : "Unable to start due prompt pipeline runs.",
      500
    )
  }
}
