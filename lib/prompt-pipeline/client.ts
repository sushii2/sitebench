import { getInsforgeBrowserClient } from "@/lib/insforge/browser-client"
import {
  promptPipelineConfigRequestSchema,
  promptPipelineQuickRunResponseSchema,
} from "@/lib/prompt-pipeline/types"

function getAuthorizationHeader() {
  const headers = getInsforgeBrowserClient().getHttpClient().getHeaders()

  return headers.Authorization ?? headers.authorization ?? null
}

async function parseJsonResponse(response: Response, fallbackMessage: string) {
  const data = await response.json().catch(() => null)

  if (!response.ok) {
    const message =
      typeof data?.error?.message === "string"
        ? data.error.message
        : fallbackMessage

    throw new Error(message)
  }

  return data
}

export async function fetchPromptPipelineConfig() {
  const authorization = getAuthorizationHeader()

  if (!authorization) {
    throw new Error("You must be signed in to load the prompt pipeline.")
  }

  const response = await fetch("/api/prompt-pipeline/config", {
    headers: {
      Authorization: authorization,
    },
  })

  return parseJsonResponse(response, "Unable to load the prompt pipeline config.")
}

export async function savePromptPipelineConfig(input: {
  frequency: string
  selectedPromptIds: string[]
}) {
  const payload = promptPipelineConfigRequestSchema.parse(input)
  const authorization = getAuthorizationHeader()

  if (!authorization) {
    throw new Error("You must be signed in to save the prompt pipeline.")
  }

  const response = await fetch("/api/prompt-pipeline/config", {
    body: JSON.stringify(payload),
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    method: "POST",
  })

  return parseJsonResponse(response, "Unable to save the prompt pipeline config.")
}

export async function startPromptPipelineQuickRun() {
  const authorization = getAuthorizationHeader()

  if (!authorization) {
    throw new Error("You must be signed in to start a quick run.")
  }

  const response = await fetch("/api/prompt-pipeline/quick-run", {
    headers: {
      Authorization: authorization,
    },
    method: "POST",
  })

  return promptPipelineQuickRunResponseSchema.parse(
    await parseJsonResponse(response, "Unable to start the prompt pipeline quick run.")
  )
}

export async function terminatePromptPipelineRun(pipelineRunId: string) {
  const authorization = getAuthorizationHeader()

  if (!authorization) {
    throw new Error("You must be signed in to terminate a run.")
  }

  const response = await fetch(
    `/api/prompt-pipeline/runs/${encodeURIComponent(pipelineRunId)}`,
    {
      headers: {
        Authorization: authorization,
      },
      method: "DELETE",
    }
  )

  return parseJsonResponse(response, "Unable to terminate the prompt pipeline run.")
}

export async function fetchPromptRunChatPayload(promptRunId: string) {
  const authorization = getAuthorizationHeader()

  if (!authorization) {
    throw new Error("You must be signed in to load the replay view.")
  }

  const response = await fetch(`/api/prompt-runs/${promptRunId}`, {
    headers: {
      Authorization: authorization,
    },
  })

  return parseJsonResponse(response, "Unable to load the prompt run replay.")
}
