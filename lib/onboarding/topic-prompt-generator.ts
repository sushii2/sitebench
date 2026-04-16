import { normalizeBrandTopics, normalizeCompanyName, normalizeWebsite } from "@/lib/brands"
import type {
  OnboardingCompetitor,
  OnboardingTopicDraft,
  OnboardingTopicInput,
  OnboardingTopicPromptResponse,
} from "@/lib/onboarding/types"
import { buildTopicPromptPair } from "@/lib/onboarding/topic-prompt-templates"

function normalizeTopicName(value: string) {
  return normalizeBrandTopics([value])[0] ?? ""
}

function normalizeCompetitorNames(competitors: OnboardingCompetitor[]) {
  return competitors.map((competitor) => normalizeCompanyName(competitor.name))
}

export function generateTopicPromptDrafts(input: {
  companyName: string
  competitors: OnboardingCompetitor[]
  description: string
  topicIndex?: number
  topicName: string
  topicSource: OnboardingTopicInput["source"]
  website: string
}): OnboardingTopicDraft {
  const topicName = normalizeTopicName(input.topicName)

  normalizeWebsite(input.website)
  const prompts = buildTopicPromptPair({
    companyName: input.companyName,
    competitors: normalizeCompetitorNames(input.competitors).slice(0, 2),
    description: input.description,
    topicIndex: input.topicIndex,
    topicName,
  })

  return {
    prompts: [
      {
        addedVia: "ai_suggested",
        promptText: prompts.discoveryPrompt,
      },
      {
        addedVia: "ai_suggested",
        promptText: prompts.comparisonPrompt,
      },
    ],
    source: input.topicSource,
    topicName,
  }
}

export function generateTopicPromptCollection(input: {
  companyName: string
  competitors: OnboardingCompetitor[]
  description: string
  topics: OnboardingTopicInput[]
  website: string
}): OnboardingTopicPromptResponse {
  return {
    topics: input.topics.map((topic, index) =>
      generateTopicPromptDrafts({
        companyName: input.companyName,
        competitors: input.competitors,
        description: input.description,
        topicIndex: index,
        topicName: topic.topicName,
        topicSource: topic.source,
        website: input.website,
      })
    ),
    warnings: [],
  }
}
