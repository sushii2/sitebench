import {
  promptRunConfigRequestSchema,
  promptRunConfigResponseSchema,
  promptRunTriggerRequestSchema,
  promptRunTriggerResponseSchema,
  type PromptRunConfigRequest,
  type PromptRunTriggerRequest,
} from "@/lib/prompt-run-configs/schemas"
import { getInsforgeBrowserClient } from "@/lib/insforge/browser-client"

function getAuthorizationHeader() {
  const headers = getInsforgeBrowserClient().getHttpClient().getHeaders()

  return headers.Authorization ?? headers.authorization ?? null
}

async function parseResponseError(
  response: Response,
  fallbackMessage: string
) {
  const data = await response.json().catch(() => null)

  return typeof data?.error?.message === "string"
    ? data.error.message
    : fallbackMessage
}

export async function fetchPromptRunConfig(projectId: string) {
  const authorization = getAuthorizationHeader()

  if (!authorization) {
    throw new Error("You must be signed in to load prompt run settings.")
  }

  const response = await fetch(
    `/api/prompt-runs/config?projectId=${encodeURIComponent(projectId)}`,
    {
      headers: {
        Authorization: authorization,
      },
      method: "GET",
    }
  )

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    throw new Error(
      await parseResponseError(response, "Unable to load prompt run settings.")
    )
  }

  const data = await response.json()

  return promptRunConfigResponseSchema.parse(data).config
}

export async function savePromptRunConfig(input: PromptRunConfigRequest) {
  const payload = promptRunConfigRequestSchema.parse(input)
  const authorization = getAuthorizationHeader()

  if (!authorization) {
    throw new Error("You must be signed in to save prompt run settings.")
  }

  const response = await fetch("/api/prompt-runs/config", {
    body: JSON.stringify(payload),
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    method: "POST",
  })

  if (!response.ok) {
    throw new Error(
      await parseResponseError(response, "Unable to save prompt run settings.")
    )
  }

  const data = await response.json()

  return promptRunConfigResponseSchema.parse(data).config
}

export async function disablePromptRunSchedule(projectId: string) {
  const authorization = getAuthorizationHeader()

  if (!authorization) {
    throw new Error("You must be signed in to disable prompt run settings.")
  }

  const response = await fetch(
    `/api/prompt-runs/config?projectId=${encodeURIComponent(projectId)}`,
    {
      headers: {
        Authorization: authorization,
      },
      method: "DELETE",
    }
  )

  if (!response.ok) {
    throw new Error(
      await parseResponseError(
        response,
        "Unable to disable prompt run settings."
      )
    )
  }

  const data = await response.json()

  return promptRunConfigResponseSchema.parse(data).config
}

export async function triggerPromptRun(input: PromptRunTriggerRequest) {
  const payload = promptRunTriggerRequestSchema.parse(input)
  const authorization = getAuthorizationHeader()

  if (!authorization) {
    throw new Error("You must be signed in to trigger prompt runs.")
  }

  const response = await fetch("/api/prompt-runs/trigger", {
    body: JSON.stringify(payload),
    headers: {
      Authorization: authorization,
      "Content-Type": "application/json",
    },
    method: "POST",
  })

  if (!response.ok) {
    throw new Error(
      await parseResponseError(response, "Unable to trigger prompt runs.")
    )
  }

  const data = await response.json()

  return promptRunTriggerResponseSchema.parse(data)
}
