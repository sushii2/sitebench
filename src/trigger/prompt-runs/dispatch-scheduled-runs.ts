import { idempotencyKeys, logger, runs, schedules } from "@trigger.dev/sdk"

import { createInsforgeServiceClient } from "@/lib/insforge/service-client"
import {
  isPromptRunClaimStale,
  isPromptRunStatusTerminallyFailed,
} from "@/src/trigger/prompt-runs/shared"
import { runConfiguredPrompts } from "@/src/trigger/prompt-runs/run-configured-prompts"
import { updatePromptRunConfigRuntimeState } from "@/lib/prompt-run-configs/repository"
import type { PromptRunConfig } from "@/lib/prompt-run-configs/types"

async function isDispatcherClaimReleasable(config: PromptRunConfig) {
  if (isPromptRunClaimStale(config.claimed_at)) {
    return true
  }

  if (!config.current_run_id) {
    return false
  }

  try {
    const run = await runs.retrieve(config.current_run_id)

    return isPromptRunStatusTerminallyFailed(run.status)
  } catch {
    return true
  }
}

function takeRows<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

async function loadDuePromptRunConfigs(referenceDate: string) {
  const client = createInsforgeServiceClient()
  const response = await client.database
    .from("prompt_run_configs")
    .select("*")
    .eq("is_enabled", true)
    .lte("next_run_at", referenceDate)
    .limit(500)

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load due prompt run configs.")
  }

  const candidates = takeRows(
    response.data as PromptRunConfig[] | PromptRunConfig | null
  )
  const releasable = await Promise.all(
    candidates.map(async (config) => ({
      config,
      releasable: await isDispatcherClaimReleasable(config),
    }))
  )

  return releasable
    .filter(({ releasable: isReleasable }) => isReleasable)
    .map(({ config }) => config)
}

export const dispatchScheduledRuns = schedules.task({
  cron: "0 * * * *",
  id: "prompt-runs.dispatch-scheduled",
  machine: "micro",
  maxDuration: 120,
  queue: {
    concurrencyLimit: 1,
    name: "prompt-runs-dispatcher",
  },
  run: async () => {
    const startedAt = new Date().toISOString()
    const dueConfigs = await loadDuePromptRunConfigs(startedAt)

    logger.info("[prompt-runs] Dispatcher started", {
      dueConfigCount: dueConfigs.length,
    })

    const handles: string[] = []
    const cadenceBucket = startedAt.slice(0, 13)

    for (const config of dueConfigs) {
      const client = createInsforgeServiceClient()

      try {
        await updatePromptRunConfigRuntimeState(client, config.project_id, {
          claimedAt: startedAt,
          currentRunId: null,
        })

        const handle = await runConfiguredPrompts.trigger(
          {
            projectId: config.project_id,
            triggerType: "scheduled",
          },
          {
            idempotencyKey: await idempotencyKeys.create([
              "prompt-runs",
              "scheduled",
              config.project_id,
              config.id,
              cadenceBucket,
            ]),
            idempotencyKeyTTL: "1h",
          }
        )

        await updatePromptRunConfigRuntimeState(client, config.project_id, {
          claimedAt: startedAt,
          currentRunId: handle.id,
        })

        handles.push(handle.id)
      } catch (error) {
        await updatePromptRunConfigRuntimeState(client, config.project_id, {
          claimedAt: null,
          currentRunId: null,
        })

        logger.error("[prompt-runs] Dispatcher failed to trigger run", {
          error: error instanceof Error ? error.message : error,
          projectId: config.project_id,
        })
      }
    }

    logger.info("[prompt-runs] Dispatcher completed", {
      dispatchedCount: handles.length,
    })

    return {
      dispatchedRunIds: handles,
    }
  },
})
