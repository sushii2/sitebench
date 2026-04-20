import { NextResponse } from "next/server"

import {
  authenticatePromptPipelineRequest,
  createAuthenticatedPromptPipelineClient,
  loadPromptPipelineConfigScreen,
  promptPipelineConfigRequestSchema,
  savePromptPipelineConfigForProject,
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

export async function GET(request: Request) {
  const authorization = request.headers.get("Authorization")
  const user = await authenticatePromptPipelineRequest(authorization)

  if (!user) {
    return createErrorResponse("You must be signed in to continue.", 401)
  }

  try {
    const client = createAuthenticatedPromptPipelineClient(authorization)
    const result = await loadPromptPipelineConfigScreen(client)

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(
      error instanceof Error
        ? error.message
        : "Unable to load the prompt pipeline config.",
      500
    )
  }
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = promptPipelineConfigRequestSchema.safeParse(body)

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body."

    return createErrorResponse(message, 400)
  }

  const authorization = request.headers.get("Authorization")
  const user = await authenticatePromptPipelineRequest(authorization)

  if (!user) {
    return createErrorResponse("You must be signed in to continue.", 401)
  }

  try {
    const client = createAuthenticatedPromptPipelineClient(authorization)
    const result = await savePromptPipelineConfigForProject(
      client,
      parsed.data,
      authorization
    )

    return NextResponse.json(result)
  } catch (error) {
    return createErrorResponse(
      error instanceof Error
        ? error.message
        : "Unable to save the prompt pipeline config.",
      500
    )
  }
}
