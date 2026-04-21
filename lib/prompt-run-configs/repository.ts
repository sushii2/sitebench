import type { InsForgeClient } from "@insforge/sdk"

import type {
  PromptRunConfig,
  PromptRunConfigInput,
  PromptRunConfigRuntimeUpdate,
} from "@/lib/prompt-run-configs/types"

type PromptRunConfigClient = Pick<InsForgeClient, "database">

function takeSingleRow<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null
  }

  return value ?? null
}

function normalizeStringArray(values: string[]) {
  return [...new Set(values)]
}

function toPromptRunConfigPayload(input: PromptRunConfigInput) {
  return {
    cadence_days: input.cadenceDays,
    enabled_providers: normalizeStringArray(input.enabledProviders),
    is_enabled: input.isEnabled ?? true,
    project_id: input.projectId,
    scheduled_run_local_time: input.scheduledRunLocalTime,
    selected_project_topic_ids: normalizeStringArray(input.selectedProjectTopicIds),
    selected_tracked_prompt_ids: normalizeStringArray(
      input.selectedTrackedPromptIds
    ),
  }
}

export async function loadPromptRunConfig(
  client: PromptRunConfigClient,
  projectId: string
): Promise<PromptRunConfig | null> {
  const response = await client.database
    .from("prompt_run_configs")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle()

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load prompt run config.")
  }

  return takeSingleRow(response.data as PromptRunConfig | PromptRunConfig[] | null)
}

export async function upsertPromptRunConfig(
  client: PromptRunConfigClient,
  input: PromptRunConfigInput
): Promise<PromptRunConfig> {
  const payload = toPromptRunConfigPayload(input)
  const existing = await loadPromptRunConfig(client, input.projectId)
  const response = existing
    ? await client.database
        .from("prompt_run_configs")
        .update(payload)
        .eq("project_id", input.projectId)
        .select("*")
        .maybeSingle()
    : await client.database
        .from("prompt_run_configs")
        .insert([
          {
            ...payload,
            claimed_at: null,
            current_run_id: null,
            last_run_at: null,
            next_run_at: null,
          },
        ])
        .select("*")
        .maybeSingle()

  if (!response || response.error || !response.data) {
    throw response?.error ?? new Error("Unable to save prompt run config.")
  }

  const config = takeSingleRow(
    response.data as PromptRunConfig | PromptRunConfig[] | null
  )

  if (!config) {
    throw new Error("Unable to save prompt run config.")
  }

  return config
}

export async function disablePromptRunConfig(
  client: PromptRunConfigClient,
  projectId: string
): Promise<PromptRunConfig | null> {
  const response = await client.database
    .from("prompt_run_configs")
    .update({
      claimed_at: null,
      current_run_id: null,
      is_enabled: false,
    })
    .eq("project_id", projectId)
    .select("*")
    .maybeSingle()

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to disable prompt run config.")
  }

  return takeSingleRow(response.data as PromptRunConfig | PromptRunConfig[] | null)
}

export async function updatePromptRunConfigRuntimeState(
  client: PromptRunConfigClient,
  projectId: string,
  values: PromptRunConfigRuntimeUpdate
): Promise<PromptRunConfig | null> {
  const response = await client.database
    .from("prompt_run_configs")
    .update({
      claimed_at: values.claimedAt,
      current_run_id: values.currentRunId,
      last_run_at: values.lastRunAt,
      next_run_at: values.nextRunAt,
    })
    .eq("project_id", projectId)
    .select("*")
    .maybeSingle()

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to update prompt run config.")
  }

  return takeSingleRow(response.data as PromptRunConfig | PromptRunConfig[] | null)
}
