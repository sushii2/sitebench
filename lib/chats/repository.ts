import type { AiPlatform } from "@/lib/ai-platforms/types"
import type {
  ChatBrandMentionSummary,
  ChatPlatformSummary,
  ChatSummary,
  PipelineRunBatch,
} from "@/lib/chats/types"
import type { PromptRunResponseStatus } from "@/lib/prompt-run-responses/types"
import type { PromptRunStatus } from "@/lib/prompt-runs/types"

type RawBrandEntity = {
  id: string
  name: string
  role: "primary" | "competitor"
}

type RawBrandMetric = {
  brand_entity_id: string
  brand_entities: RawBrandEntity | null
}

type RawCitation = { id: string }

type RawResponse = {
  id: string
  platform_code: string
  status: PromptRunResponseStatus
  response_brand_metrics: RawBrandMetric[] | null
  response_citations: RawCitation[] | null
}

type RawRun = {
  id: string
  project_id: string
  project_topic_id: string
  tracked_prompt_id: string
  scheduled_for: string
  completed_at: string | null
  status: PromptRunStatus
  project_topics: { id: string; name: string } | null
  tracked_prompts: { id: string; prompt_text: string } | null
  prompt_run_responses: RawResponse[] | null
}

function toDay(iso: string): string {
  return iso.slice(0, 10)
}

function buildPlatforms(
  responses: RawResponse[],
  platforms: AiPlatform[]
): ChatPlatformSummary[] {
  const byCode = new Map<string, RawResponse>()

  for (const response of responses) {
    byCode.set(response.platform_code, response)
  }

  return [...platforms]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((platform) => {
      const response = byCode.get(platform.code)

      return {
        code: platform.code,
        label: platform.label,
        responseId: response?.id ?? null,
        status: response?.status ?? "missing",
      }
    })
}

function collectBrandMentions(
  responses: RawResponse[]
): ChatBrandMentionSummary[] {
  const seen = new Map<string, ChatBrandMentionSummary>()

  for (const response of responses) {
    for (const metric of response.response_brand_metrics ?? []) {
      if (!metric.brand_entities || seen.has(metric.brand_entity_id)) {
        continue
      }

      seen.set(metric.brand_entity_id, {
        brandEntityId: metric.brand_entity_id,
        name: metric.brand_entities.name,
        role: metric.brand_entities.role,
      })
    }
  }

  return [...seen.values()]
}

function countSources(responses: RawResponse[]): number {
  let total = 0

  for (const response of responses) {
    total += (response.response_citations ?? []).length
  }

  return total
}

export function mapChatSummaryRows(
  rows: RawRun[],
  platforms: AiPlatform[]
): ChatSummary[] {
  return rows.map((row) => {
    const responses = row.prompt_run_responses ?? []

    return {
      brandMentions: collectBrandMentions(responses),
      completedAt: row.completed_at,
      platforms: buildPlatforms(responses, platforms),
      promptRunId: row.id,
      promptText: row.tracked_prompts?.prompt_text ?? "",
      projectTopicId: row.project_topic_id,
      scheduledFor: row.scheduled_for,
      sourceCount: countSources(responses),
      status: row.status,
      topicName: row.project_topics?.name ?? "",
      trackedPromptId: row.tracked_prompt_id,
    }
  })
}

export function mapPipelineRunBatchRows(
  rows: Array<{ scheduled_for: string }>
): PipelineRunBatch[] {
  const counts = new Map<string, number>()

  for (const row of rows) {
    const date = toDay(row.scheduled_for)

    counts.set(date, (counts.get(date) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, count]) => ({ count, date }))
}
