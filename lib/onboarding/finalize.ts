import type { InsForgeClient } from "@insforge/sdk"

import {
  markOnboardingComplete,
  normalizeBrandTopics,
  replaceBrandCompetitors,
  saveBrandDraftStep,
} from "@/lib/brands"
import type { CompleteOnboardingRequest } from "@/lib/onboarding/types"
import { syncProjectTopics } from "@/lib/project-topics/repository"
import { syncTrackedPromptsForTopics } from "@/lib/tracked-prompts/repository"

type OnboardingClient = Pick<InsForgeClient, "auth" | "database">

export async function completeOnboardingSetup(
  client: OnboardingClient,
  input: CompleteOnboardingRequest
) {
  console.log("[onboarding] Starting completion", {
    competitorCount: input.competitors.length,
    projectId: input.projectId,
    topicCount: input.topics.length,
  })

  await saveBrandDraftStep(client, {
    company_name: input.companyName,
    website: input.website,
  })
  await saveBrandDraftStep(client, {
    description: input.description,
  })
  await replaceBrandCompetitors(client, input.projectId, input.competitors)

  const syncedTopics = await syncProjectTopics(client, {
    projectId: input.projectId,
    topics: input.topics.map((topic) => ({
      source: topic.source,
      topicName: topic.topicName,
    })),
  })

  console.log("[onboarding] Synced topics", {
    projectId: input.projectId,
    topicCount: syncedTopics.length,
  })

  const topicIdByNormalizedName = new Map(
    syncedTopics.map((topic) => [topic.normalized_name, topic.id])
  )

  await syncTrackedPromptsForTopics(client, {
    projectId: input.projectId,
    topics: input.topics.map((topic) => {
      const normalizedTopicName = normalizeBrandTopics([topic.topicName])[0]
      const topicId = normalizedTopicName
        ? topicIdByNormalizedName.get(normalizedTopicName)
        : null

      if (!topicId) {
        throw new Error(`Unable to resolve topic ID for ${topic.topicName}.`)
      }

      return {
        prompts: topic.prompts,
        topicId,
        topicName: topic.topicName,
      }
    }),
  })

  console.log("[onboarding] Synced tracked prompts", {
    projectId: input.projectId,
    topicCount: input.topics.length,
  })

  return markOnboardingComplete(client, input.projectId)
}
