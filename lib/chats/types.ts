import type { AiPlatform } from "@/lib/ai-platforms/types"
import type { BrandEntity, BrandRole } from "@/lib/brand-entities/types"
import type { ProjectTopic } from "@/lib/project-topics/types"
import type {
  PromptRun,
  PromptRunStatus,
} from "@/lib/prompt-runs/types"
import type {
  PromptRunResponse,
  PromptRunResponseStatus,
} from "@/lib/prompt-run-responses/types"
import type { ResponseBrandMetric } from "@/lib/response-brand-metrics/types"
import type { ResponseCitation } from "@/lib/response-citations/types"
import type { SourceDomain } from "@/lib/source-domains/types"
import type { SourcePage } from "@/lib/source-pages/types"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"
import type { SentimentLabel } from "@/lib/response-brand-metrics/types"

export type PlatformSummaryStatus = PromptRunResponseStatus | "missing"

export interface ChatPlatformSummary {
  code: string
  label: string
  status: PlatformSummaryStatus
  responseId: string | null
}

export interface ChatBrandMentionSummary {
  brandEntityId: string
  name: string
  role: BrandRole
  websiteHost: string | null
}

export interface ChatSummary {
  promptRunId: string
  projectTopicId: string
  topicName: string
  trackedPromptId: string
  promptText: string
  scheduledFor: string
  completedAt: string | null
  status: PromptRunStatus
  platforms: ChatPlatformSummary[]
  brandMentions: ChatBrandMentionSummary[]
  sourceCount: number
}

export interface ChatBrandMention {
  brand: BrandEntity
  metric: ResponseBrandMetric
}

export interface ChatSource {
  citation: ResponseCitation
  page: SourcePage
  domain: SourceDomain
  matchedBrand: BrandEntity | null
}

export interface ChatSourceGroup {
  cited: ChatSource[]
  notCited: ChatSource[]
}

export interface ChatResponseView {
  response: PromptRunResponse
  platform: AiPlatform | null
  platformLabel: string
  brands: ChatBrandMention[]
  sources: ChatSourceGroup
}

export interface ChatDetail {
  promptRun: PromptRun
  topic: ProjectTopic
  trackedPrompt: TrackedPrompt
  chatSentiment: ChatSentimentSummary | null
  responses: ChatResponseView[]
}

export interface ChatSentimentSummary {
  label: SentimentLabel
  score: number
  sampleSize: number
}

export interface PipelineRunBatch {
  date: string
  count: number
}
