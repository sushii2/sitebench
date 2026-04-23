import { describe, expect, it } from "vitest"

import {
  buildChatDetail,
  type LoadedCitation,
} from "@/lib/chats/repository"
import type { AiPlatform } from "@/lib/ai-platforms/types"
import type { BrandEntity } from "@/lib/brand-entities/types"

type BuildArg = Parameters<typeof buildChatDetail>[0]

const platforms: AiPlatform[] = [
  {
    code: "chatgpt",
    created_at: "2026-01-01T00:00:00.000Z",
    is_active: true,
    label: "ChatGPT",
    sort_order: 0,
    updated_at: "2026-01-01T00:00:00.000Z",
  },
]

const brand: BrandEntity = {
  created_at: "2026-04-01T00:00:00.000Z",
  description: "",
  id: "brand-1",
  is_active: true,
  name: "Vercel",
  normalized_name: "vercel",
  project_id: "project-1",
  role: "primary",
  sort_order: 0,
  updated_at: "2026-04-01T00:00:00.000Z",
  website_host: "vercel.com",
  website_url: "https://vercel.com",
}

const topic = {
  created_at: "2026-04-01T00:00:00.000Z",
  default_cadence: "weekly",
  id: "topic-1",
  is_active: true,
  name: "Deployment",
  normalized_name: "deployment",
  project_id: "project-1",
  sort_order: 0,
  source: "user_added",
  topic_catalog_id: null,
  updated_at: "2026-04-01T00:00:00.000Z",
}

const trackedPrompt = {
  cadence_days: 7,
  created_at: "2026-04-01T00:00:00.000Z",
  id: "prompt-1",
  is_active: true,
  normalized_prompt: "best nextjs deployment platform",
  project_id: "project-1",
  project_topic_id: "topic-1",
  prompt_text: "Best Next.js deployment platform?",
  source: "ai_suggested",
  sort_order: 0,
  updated_at: "2026-04-01T00:00:00.000Z",
}

function baseRun(overrides: {
  project_topics?: unknown
  tracked_prompts?: unknown
} = {}): BuildArg {
  return {
    cadence_applied: "weekly",
    completed_at: "2026-04-20T12:05:00.000Z",
    created_at: "2026-04-20T12:00:00.000Z",
    failure_reason: null,
    id: "run-1",
    project_id: "project-1",
    project_topic_id: "topic-1",
    project_topics: overrides.project_topics ?? topic,
    prompt_run_responses: [
      {
        created_at: "2026-04-20T12:05:00.000Z",
        error_code: null,
        error_message: null,
        id: "resp-1",
        input_tokens: 10,
        latency_ms: 500,
        output_tokens: 20,
        parser_version: "2026-04-21",
        platform_code: "chatgpt",
        project_id: "project-1",
        prompt_run_id: "run-1",
        prompt_text: "Best Next.js deployment platform?",
        provider_model: "gpt-5",
        raw_response_json: null,
        raw_response_text: "Vercel is great.",
        responded_at: "2026-04-20T12:02:00.000Z",
        response_brand_metrics: [
          {
            brand_entities: brand,
            brand_entity_id: "brand-1",
            citation_score: 0.8,
            created_at: "2026-04-20T12:05:00.000Z",
            id: "metric-1",
            mention_count: 2,
            project_id: "project-1",
            rank_position: 1,
            recommendation_status: "recommended",
            response_id: "resp-1",
            sentiment_label: "positive",
            sentiment_score: 0.6,
            visibility_score: 72,
          },
        ],
        status: "completed",
        updated_at: "2026-04-20T12:05:00.000Z",
      },
    ],
    scheduled_for: "2026-04-20T12:00:00.000Z",
    started_at: "2026-04-20T12:00:00.000Z",
    status: "completed",
    tracked_prompt_id: "prompt-1",
    tracked_prompts: overrides.tracked_prompts ?? trackedPrompt,
    trigger_type: "scheduled",
  } as unknown as BuildArg
}

function makeCitation(
  responseId: string,
  url = "https://vercel.com/docs"
): LoadedCitation {
  return {
    attributedBrandIds: [],
    citation: {
      authority_score: null,
      citation_order: 1,
      citation_text: null,
      cited_url: url,
      created_at: "2026-04-20T12:05:00.000Z",
      id: "cit-1",
      project_id: "project-1",
      response_id: responseId,
      source_page_id: "page-1",
    },
    page: {
      canonical_url: url,
      domain_id: "domain-1",
      first_seen_at: "2026-04-20T12:00:00.000Z",
      id: "page-1",
      page_title: "Vercel Docs",
    },
    domain: {
      created_at: "2026-04-20T12:00:00.000Z",
      display_name: null,
      domain: "vercel.com",
      id: "domain-1",
      root_domain: "vercel.com",
    },
  }
}

describe("buildChatDetail", () => {
  it("attaches citations to the matching response via the responseId map", () => {
    const citationsByResponseId = new Map([
      ["resp-1", [makeCitation("resp-1")]],
    ])
    const detail = buildChatDetail(
      baseRun(),
      [brand],
      platforms,
      citationsByResponseId
    )

    expect(detail?.responses[0].sources.cited).toHaveLength(1)
    expect(detail?.responses[0].sources.cited[0].domain.domain).toBe(
      "vercel.com"
    )
  })

  it("leaves sources empty when no citation map is passed", () => {
    const detail = buildChatDetail(baseRun(), [brand], platforms)

    expect(detail?.responses[0].sources.cited).toHaveLength(0)
    expect(detail?.responses[0].sources.notCited).toHaveLength(0)
  })

  it("groups unmatched domains into notCited", () => {
    const citationsByResponseId = new Map([
      [
        "resp-1",
        [makeCitation("resp-1", "https://example.com/post")].map((c) => ({
          ...c,
          domain: {
            created_at: c.domain.created_at,
            display_name: null,
            domain: "example.com",
            id: "domain-2",
            root_domain: "example.com",
          },
        })),
      ],
    ])
    const detail = buildChatDetail(
      baseRun(),
      [brand],
      platforms,
      citationsByResponseId
    )

    expect(detail?.responses[0].sources.cited).toHaveLength(0)
    expect(detail?.responses[0].sources.notCited).toHaveLength(1)
  })

  it("uses persisted citation attribution before falling back to domain matching", () => {
    const citationsByResponseId = new Map([
      [
        "resp-1",
        [
          {
            ...makeCitation("resp-1", "https://example.com/post"),
            attributedBrandIds: ["brand-1"],
            domain: {
              created_at: "2026-04-20T12:00:00.000Z",
              display_name: null,
              domain: "example.com",
              id: "domain-2",
              root_domain: "example.com",
            },
          },
        ],
      ],
    ])

    const detail = buildChatDetail(
      baseRun(),
      [brand],
      platforms,
      citationsByResponseId
    )

    expect(detail?.responses[0].sources.cited).toHaveLength(1)
    expect(detail?.responses[0].sources.cited[0].matchedBrand?.id).toBe(
      "brand-1"
    )
    expect(detail?.responses[0].sources.notCited).toHaveLength(0)
  })

  it("computes a chat-level sentiment summary from the primary-brand metrics", () => {
    const detail = buildChatDetail(baseRun(), [brand], platforms)

    expect(detail?.chatSentiment).toMatchObject({
      label: "positive",
      sampleSize: 1,
    })
    expect(detail?.chatSentiment?.score).toBeGreaterThan(0)
  })

  it("tolerates project_topics and tracked_prompts returned as arrays", () => {
    const detail = buildChatDetail(
      baseRun({
        project_topics: [topic],
        tracked_prompts: [trackedPrompt],
      }),
      [brand],
      platforms
    )

    expect(detail?.topic.name).toBe("Deployment")
    expect(detail?.trackedPrompt.prompt_text).toBe(
      "Best Next.js deployment platform?"
    )
  })
})
