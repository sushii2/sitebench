import { NextResponse } from "next/server"
import { auth, runs } from "@trigger.dev/sdk"

import {
  authenticateOnboardingRequest,
  createAuthenticatedOnboardingClient,
} from "@/lib/onboarding"
import { loadPromptRunConfig, updatePromptRunConfigRuntimeState } from "@/lib/prompt-run-configs/repository"
import { promptRunTriggerRequestSchema } from "@/lib/prompt-run-configs/schemas"
import {
  isPromptRunClaimStale,
  isPromptRunStatusTerminallyFailed,
} from "@/src/trigger/prompt-runs/shared"
import { runConfiguredPrompts } from "@/src/trigger/prompt-runs/run-configured-prompts"

async function isActiveRunHealthy(runId: string | null) {
  if (!runId) {
    return false
  }

  try {
    const run = await runs.retrieve(runId)

    return !isPromptRunStatusTerminallyFailed(run.status)
  } catch {
    return false
  }
}

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
  const parsed = promptRunTriggerRequestSchema.safeParse(body)

  if (!parsed.success) {
    return createErrorResponse(
      parsed.error.issues[0]?.message ?? "Invalid request body.",
      400
    )
  }

  const authorization = request.headers.get("Authorization")
  const user = await authenticateOnboardingRequest(authorization)

  if (!user) {
    return createErrorResponse("You must be signed in to continue.", 401)
  }

  const client = createAuthenticatedOnboardingClient(authorization)
  const config = await loadPromptRunConfig(client, parsed.data.projectId)

  if (!config || !config.is_enabled) {
    return createErrorResponse("Prompt run configuration not found.", 404)
  }

  if (!isPromptRunClaimStale(config.claimed_at)) {
    if (!config.current_run_id) {
      return createErrorResponse(
        "A prompt run is already being started for this project.",
        409
      )
    }

    if (await isActiveRunHealthy(config.current_run_id)) {
      return NextResponse.json({
        publicAccessToken: await auth.createPublicToken({
          expirationTime: "1h",
          scopes: {
            read: {
              runs: [config.current_run_id],
            },
          },
        }),
        runId: config.current_run_id,
      })
    }

    await updatePromptRunConfigRuntimeState(client, parsed.data.projectId, {
      claimedAt: null,
      currentRunId: null,
    })
  }

  const handle = await runConfiguredPrompts.trigger(
    {
      projectId: parsed.data.projectId,
      triggerType: "manual",
    },
    {
      idempotencyKey: [
        "prompt-runs",
        "manual",
        parsed.data.projectId,
        new Date().toISOString().slice(0, 16),
      ],
      tags: [
        `project:${parsed.data.projectId}`,
        "trigger:manual",
        `config:${config.id}`,
        "runner:prompt-runs",
      ],
    }
  )

  await updatePromptRunConfigRuntimeState(client, parsed.data.projectId, {
    claimedAt: new Date().toISOString(),
    currentRunId: handle.id,
  })

  return NextResponse.json({
    publicAccessToken: await auth.createPublicToken({
      expirationTime: "1h",
      scopes: {
        read: {
          runs: [handle.id],
        },
      },
    }),
    runId: handle.id,
  })
}
