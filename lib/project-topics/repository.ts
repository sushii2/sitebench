import type { InsForgeClient } from "@insforge/sdk"

import { normalizeBrandTopics } from "@/lib/brands"
import type { OnboardingTopicDraft } from "@/lib/onboarding/types"
import type { ProjectTopic, TopicCadence, TopicSource } from "@/lib/project-topics/types"

type TopicClient = Pick<InsForgeClient, "database">

function takeRows<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

function toTopicPayload(
  topic: Pick<OnboardingTopicDraft, "source" | "topicName">,
  index: number,
  projectId: string,
  defaultCadence: TopicCadence
) {
  const normalizedTopic = normalizeBrandTopics([topic.topicName])[0]

  if (!normalizedTopic) {
    throw new Error("Topic name is required.")
  }

  return {
    default_cadence: defaultCadence,
    is_active: true,
    name: normalizedTopic,
    normalized_name: normalizedTopic,
    project_id: projectId,
    sort_order: index,
    source: topic.source satisfies TopicSource,
    topic_catalog_id: null,
  }
}

export async function loadProjectTopics(
  client: TopicClient,
  projectId: string
): Promise<ProjectTopic[]> {
  const response = await client.database
    .from("project_topics")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load project topics.")
  }

  return takeRows(response.data as ProjectTopic[] | ProjectTopic | null)
}

export async function syncProjectTopics(
  client: TopicClient,
  input: {
    defaultCadence?: TopicCadence
    projectId: string
    topics: Array<Pick<OnboardingTopicDraft, "source" | "topicName">>
  }
): Promise<ProjectTopic[]> {
  const defaultCadence = input.defaultCadence ?? "weekly"
  const existingTopics = await loadProjectTopics(client, input.projectId)
  const desiredTopics = input.topics.map((topic, index) =>
    toTopicPayload(topic, index, input.projectId, defaultCadence)
  )
  const desiredByNormalized = new Map(
    desiredTopics.map((topic) => [topic.normalized_name, topic])
  )

  const topicsToDeactivate = existingTopics
    .filter(
      (topic) =>
        topic.is_active && !desiredByNormalized.has(topic.normalized_name)
    )
    .map((topic) => topic.id)

  if (topicsToDeactivate.length > 0) {
    const deactivateResponse = await client.database
      .from("project_topics")
      .update({
        is_active: false,
      })
      .in("id", topicsToDeactivate)
      .select("*")

    if (!deactivateResponse || deactivateResponse.error) {
      throw (
        deactivateResponse?.error ?? new Error("Unable to deactivate topics.")
      )
    }
  }

  for (const topic of desiredTopics) {
    const existing = existingTopics.find(
      (candidate) => candidate.normalized_name === topic.normalized_name
    )

    if (existing) {
      const updateResponse = await client.database
        .from("project_topics")
        .update({
          default_cadence: topic.default_cadence,
          is_active: true,
          sort_order: topic.sort_order,
          source: topic.source,
        })
        .eq("id", existing.id)
        .select("*")

      if (!updateResponse || updateResponse.error) {
        throw updateResponse?.error ?? new Error("Unable to update topics.")
      }

      continue
    }

    const insertResponse = await client.database
      .from("project_topics")
      .insert([topic])
      .select("*")

    if (!insertResponse || insertResponse.error) {
      throw insertResponse?.error ?? new Error("Unable to insert topics.")
    }
  }

  return (await loadProjectTopics(client, input.projectId)).filter((topic) =>
    desiredByNormalized.has(topic.normalized_name)
  )
}
