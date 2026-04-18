import type { InsForgeClient } from "@insforge/sdk"

import type { OnboardingPromptDraft } from "@/lib/onboarding/types"
import { resolvePromptCatalogId } from "@/lib/prompt-catalog/repository"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

type PromptClient = Pick<InsForgeClient, "database">

function takeRows<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

export function normalizePromptText(value: string) {
  return normalizeWhitespace(value).toLowerCase()
}

function dedupePrompts(prompts: OnboardingPromptDraft[]) {
  const deduped: OnboardingPromptDraft[] = []
  const seen = new Set<string>()

  for (const prompt of prompts) {
    const normalizedPrompt = normalizePromptText(prompt.promptText)

    if (!normalizedPrompt || seen.has(normalizedPrompt)) {
      continue
    }

    seen.add(normalizedPrompt)
    deduped.push({
      ...prompt,
      promptText: normalizeWhitespace(prompt.promptText),
    })
  }

  return deduped
}

export async function loadTrackedPromptsByProject(
  client: PromptClient,
  projectId: string
): Promise<TrackedPrompt[]> {
  const response = await client.database
    .from("tracked_prompts")
    .select("*")
    .eq("project_id", projectId)

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load tracked prompts.")
  }

  return takeRows(response.data as TrackedPrompt[] | TrackedPrompt | null)
}

export async function syncTrackedPromptsForTopics(
  client: PromptClient,
  input: {
    projectId: string
    topics: Array<{
      prompts: OnboardingPromptDraft[]
      topicId: string
      topicName: string
    }>
  }
): Promise<TrackedPrompt[]> {
  const existingPrompts = await loadTrackedPromptsByProject(client, input.projectId)
  const desiredTopicIds = new Set(input.topics.map((topic) => topic.topicId))
  const desiredNormalizedByTopic = new Map<string, Set<string>>()
  const promptCatalogIdByTemplate = new Map<string, string | null>()

  for (const topic of input.topics) {
    const dedupedPrompts = dedupePrompts(topic.prompts)
    const normalizedSet = new Set<string>()

    for (const prompt of dedupedPrompts) {
      const normalizedPrompt = normalizePromptText(prompt.promptText)
      const promptCatalogId = await resolvePromptCatalogId(
        client,
        prompt,
        promptCatalogIdByTemplate
      )

      normalizedSet.add(normalizedPrompt)
      const existing = existingPrompts.find(
        (candidate) =>
          candidate.project_topic_id === topic.topicId &&
          candidate.normalized_prompt === normalizedPrompt
      )

      if (existing) {
        const updateResponse = await client.database
          .from("tracked_prompts")
          .update({
            added_via: prompt.addedVia,
            is_active: true,
            pqs_rank: prompt.pqsRank ?? null,
            pqs_score: prompt.pqsScore ?? null,
            prompt_catalog_id: promptCatalogId,
            prompt_text: normalizeWhitespace(prompt.promptText),
            score_metadata: prompt.scoreMetadata ?? {},
            score_status: prompt.scoreStatus ?? "unscored",
            source_analysis_run_id: prompt.sourceAnalysisRunId ?? null,
            variant_type: prompt.variantType ?? null,
          })
          .eq("id", existing.id)
          .select("*")

        if (!updateResponse || updateResponse.error) {
          throw updateResponse?.error ?? new Error("Unable to update prompts.")
        }

        continue
      }

      const insertResponse = await client.database
        .from("tracked_prompts")
        .insert([
          {
            added_via: prompt.addedVia,
            cadence_override: null,
            is_active: true,
            normalized_prompt: normalizedPrompt,
            pqs_rank: prompt.pqsRank ?? null,
            pqs_score: prompt.pqsScore ?? null,
            project_id: input.projectId,
            project_topic_id: topic.topicId,
            prompt_catalog_id: promptCatalogId,
            prompt_text: normalizeWhitespace(prompt.promptText),
            score_metadata: prompt.scoreMetadata ?? {},
            score_status: prompt.scoreStatus ?? "unscored",
            source_analysis_run_id: prompt.sourceAnalysisRunId ?? null,
            variant_type: prompt.variantType ?? null,
          },
        ])
        .select("*")

      if (!insertResponse || insertResponse.error) {
        throw insertResponse?.error ?? new Error("Unable to insert prompts.")
      }
    }

    desiredNormalizedByTopic.set(topic.topicId, normalizedSet)
  }

  const promptsToDeactivate = existingPrompts
    .filter((prompt) => {
      if (!prompt.is_active) {
        return false
      }

      if (!desiredTopicIds.has(prompt.project_topic_id)) {
        return true
      }

      return !desiredNormalizedByTopic
        .get(prompt.project_topic_id)
        ?.has(prompt.normalized_prompt)
    })
    .map((prompt) => prompt.id)

  if (promptsToDeactivate.length > 0) {
    const deactivateResponse = await client.database
      .from("tracked_prompts")
      .update({
        is_active: false,
      })
      .in("id", promptsToDeactivate)
      .select("*")

    if (!deactivateResponse || deactivateResponse.error) {
      throw deactivateResponse?.error ?? new Error("Unable to deactivate prompts.")
    }
  }

  return (await loadTrackedPromptsByProject(client, input.projectId)).filter(
    (prompt) =>
      desiredTopicIds.has(prompt.project_topic_id) &&
      prompt.is_active
  )
}
