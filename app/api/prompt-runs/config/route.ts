import { NextResponse } from "next/server"

import {
  authenticateOnboardingRequest,
  createAuthenticatedOnboardingClient,
} from "@/lib/onboarding"
import {
  disablePromptRunConfig,
  loadPromptRunConfig,
  upsertPromptRunConfig,
} from "@/lib/prompt-run-configs/repository"
import {
  promptRunConfigQuerySchema,
  promptRunConfigRequestSchema,
} from "@/lib/prompt-run-configs/schemas"
import { loadProjectTopics } from "@/lib/project-topics/repository"
import { loadTrackedPromptsByProject } from "@/lib/tracked-prompts/repository"

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

async function authenticatePromptRunRequest(request: Request) {
  const authorization = request.headers.get("Authorization")
  const user = await authenticateOnboardingRequest(authorization)

  if (!user) {
    return {
      authorization,
      client: null,
      user: null,
    }
  }

  return {
    authorization,
    client: createAuthenticatedOnboardingClient(authorization),
    user,
  }
}

export async function GET(request: Request) {
  const parsed = promptRunConfigQuerySchema.safeParse({
    projectId: new URL(request.url).searchParams.get("projectId"),
  })

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "Invalid project ID.",
      400
    )
  }

  const { client, user } = await authenticatePromptRunRequest(request)

  if (!user || !client) {
    return createErrorResponse("You must be signed in to continue.", 401)
  }

  const config = await loadPromptRunConfig(client, parsed.data.projectId)

  if (!config) {
    return createErrorResponse("Prompt run configuration not found.", 404)
  }

  return NextResponse.json({
    config,
  })
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = promptRunConfigRequestSchema.safeParse(body)

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "Invalid request body.",
      400
    )
  }

  const { client, user } = await authenticatePromptRunRequest(request)

  if (!user || !client) {
    return createErrorResponse("You must be signed in to continue.", 401)
  }

  try {
    const [projectTopics, trackedPrompts] = await Promise.all([
      loadProjectTopics(client, parsed.data.projectId),
      loadTrackedPromptsByProject(client, parsed.data.projectId),
    ])
    const validTopicIds = new Set(projectTopics.map((topic) => topic.id))
    const promptById = new Map(
      trackedPrompts
        .filter((prompt) => prompt.is_active)
        .map((prompt) => [prompt.id, prompt])
    )
    const selectedPrompts = parsed.data.selectedTrackedPromptIds.map((promptId) =>
      promptById.get(promptId)
    )

    if (selectedPrompts.some((prompt) => !prompt)) {
      return createErrorResponse(
        "Prompt run selections must use prompts from the current project.",
        400
      )
    }

    const selectedTopicIds = [
      ...new Set(selectedPrompts.map((prompt) => prompt!.project_topic_id)),
    ]

    if (selectedTopicIds.some((topicId) => !validTopicIds.has(topicId))) {
      return createErrorResponse(
        "Prompt run selections must use topics from the current project.",
        400
      )
    }

    const config = await upsertPromptRunConfig(client, {
      cadenceDays: parsed.data.cadenceDays,
      enabledProviders: parsed.data.enabledProviders,
      isEnabled: parsed.data.isEnabled,
      projectId: parsed.data.projectId,
      scheduledRunLocalTime: parsed.data.scheduledRunLocalTime,
      selectedProjectTopicIds: selectedTopicIds,
      selectedTrackedPromptIds: parsed.data.selectedTrackedPromptIds,
    })

    return NextResponse.json({
      config,
    })
  } catch (error) {
    return createErrorResponse(
      error instanceof Error
        ? error.message
        : "Unable to save prompt run configuration.",
      500
    )
  }
}

export async function DELETE(request: Request) {
  const parsed = promptRunConfigQuerySchema.safeParse({
    projectId: new URL(request.url).searchParams.get("projectId"),
  })

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "Invalid project ID.",
      400
    )
  }

  const { client, user } = await authenticatePromptRunRequest(request)

  if (!user || !client) {
    return createErrorResponse("You must be signed in to continue.", 401)
  }

  const config = await disablePromptRunConfig(client, parsed.data.projectId)

  if (!config) {
    return createErrorResponse("Prompt run configuration not found.", 404)
  }

  return NextResponse.json({
    config,
  })
}
