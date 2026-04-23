import { beforeEach, describe, expect, it, vi } from "vitest"

const mockCreateInsforgeServiceClient = vi.fn()

vi.mock("@/lib/insforge/service-client", () => ({
  createInsforgeServiceClient: mockCreateInsforgeServiceClient,
}))

vi.mock("@trigger.dev/sdk", () => ({
  AbortTaskRunError: class AbortTaskRunError extends Error {},
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
  task: vi.fn((definition) => definition),
}))

function makeQueryBuilder<TResult>(options: {
  insertResult?: TResult
  selectResult: TResult
}) {
  let result = options.selectResult
  const builder: Record<string, unknown> = {}

  builder.eq = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.insert = vi.fn(() => {
    result = options.insertResult ?? options.selectResult
    return builder
  })
  builder.maybeSingle = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.select = vi.fn(() => builder)
  builder.then = vi.fn((resolve, reject) =>
    Promise.resolve(result).then(resolve, reject)
  )

  return builder as {
    eq: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    select: ReturnType<typeof vi.fn>
    then: ReturnType<typeof vi.fn>
  }
}

async function loadModule() {
  return import("@/src/trigger/prompt-runs/persist-results")
}

describe("prompt run persist results", () => {
  beforeEach(() => {
    vi.resetModules()
    mockCreateInsforgeServiceClient.mockReset()
  })

  it("persists prompt run results without discovered competitor data", async () => {
    const brandEntitiesBuilder = makeQueryBuilder({
      insertResult: {
        data: {
          created_at: "2026-04-21T00:00:00.000Z",
          description: "AI-discovered competitor",
          id: "brand-2",
          is_active: true,
          name: "Competitor X",
          normalized_name: "competitor x",
          project_id: "project-1",
          role: "competitor",
          sort_order: 1,
          updated_at: "2026-04-21T00:00:00.000Z",
          website_host: "competitor-x.com",
          website_url: "https://competitor-x.com",
        },
        error: null,
      },
      selectResult: {
        data: [
          {
            created_at: "2026-04-21T00:00:00.000Z",
            description: "Primary brand",
            id: "brand-1",
            is_active: true,
            name: "Acme",
            normalized_name: "acme",
            project_id: "project-1",
            role: "primary",
            sort_order: 0,
            updated_at: "2026-04-21T00:00:00.000Z",
            website_host: "acme.com",
            website_url: "https://acme.com",
          },
        ],
        error: null,
      },
    })
    const promptRunsBuilder = makeQueryBuilder({
      insertResult: {
        data: [
          {
            cadence_applied: "manual",
            completed_at: "2026-04-21T12:05:00.000Z",
            created_at: "2026-04-21T12:05:00.000Z",
            failure_reason: null,
            id: "prompt-run-1",
            project_id: "project-1",
            project_topic_id: "topic-1",
            scheduled_for: "2026-04-21T12:00:00.000Z",
            started_at: "2026-04-21T12:00:00.000Z",
            status: "completed",
            tracked_prompt_id: "tracked-prompt-1",
            trigger_type: "manual",
            updated_at: "2026-04-21T12:05:00.000Z",
          },
        ],
        error: null,
      },
      selectResult: { data: [], error: null },
    })
    const promptRunResponsesBuilder = makeQueryBuilder({
      insertResult: {
        data: [
          {
            created_at: "2026-04-21T12:05:00.000Z",
            error_code: null,
            error_message: null,
            id: "response-1",
            input_tokens: 10,
            latency_ms: 500,
            output_tokens: 20,
            parser_version: "2026-04-21",
            platform_code: "chatgpt",
            project_id: "project-1",
            prompt_run_id: "prompt-run-1",
            prompt_text: "How visible is Acme?",
            provider_model: "gpt-5",
            raw_response_json: null,
            raw_response_text: "Acme is visible.",
            responded_at: "2026-04-21T12:02:00.000Z",
            status: "completed",
            updated_at: "2026-04-21T12:05:00.000Z",
          },
        ],
        error: null,
      },
      selectResult: { data: [], error: null },
    })
    const responseBrandMetricsBuilder = makeQueryBuilder({
      insertResult: {
        data: [
          {
            brand_entity_id: "brand-1",
            citation_score: 0,
            created_at: "2026-04-21T12:05:00.000Z",
            id: "metric-1",
            mention_count: 1,
            project_id: "project-1",
            rank_position: 1,
            recommendation_status: "mentioned",
            response_id: "response-1",
            sentiment_label: "neutral",
            sentiment_score: null,
            updated_at: "2026-04-21T12:05:00.000Z",
            visibility_score: 100,
          },
        ],
        error: null,
      },
      selectResult: { data: [], error: null },
    })
    const responseCitationsBuilder = makeQueryBuilder({
      insertResult: { data: [], error: null },
      selectResult: { data: [], error: null },
    })
    const from = vi.fn((table: string) => {
      switch (table) {
        case "brand_entities":
          return brandEntitiesBuilder
        case "prompt_runs":
          return promptRunsBuilder
        case "prompt_run_responses":
          return promptRunResponsesBuilder
        case "response_brand_metrics":
          return responseBrandMetricsBuilder
        case "response_citations":
          return responseCitationsBuilder
        default:
          throw new Error(`Unexpected table: ${table}`)
      }
    })

    mockCreateInsforgeServiceClient.mockReturnValue({
      database: {
        from,
      },
    })

    const { persistResults } = await loadModule()
    const persistResultsTask = persistResults as unknown as {
      run: (payload: unknown) => Promise<{
        promptRunCount: number
        responseCount: number
      }>
    }
    const result = await persistResultsTask.run({
      brands: [
        {
          created_at: "2026-04-21T00:00:00.000Z",
          description: "Primary brand",
          id: "brand-1",
          is_active: true,
          name: "Acme",
          normalized_name: "acme",
          project_id: "project-1",
          role: "primary",
          sort_order: 0,
          updated_at: "2026-04-21T00:00:00.000Z",
          website_host: "acme.com",
          website_url: "https://acme.com",
        },
      ],
      cadenceApplied: "manual",
      cadenceDays: 7,
      completedAt: "2026-04-21T12:05:00.000Z",
      configId: "config-1",
      projectId: "project-1",
      promptRuns: [
        {
          failureReason: null,
          projectTopicId: "topic-1",
          promptText: "How visible is Acme?",
          providerResults: [
            {
              brandMetrics: [
                {
                  brandEntityId: "brand-1",
                  citationScore: 0,
                  citationUrls: [],
                  mentionCount: 1,
                  rankPosition: 1,
                  recommendationStatus: "mentioned",
                  sentimentLabel: "neutral",
                  sentimentScore: null,
                  visibilityScore: 100,
                },
              ],
              citations: [],
              errorCode: null,
              errorMessage: null,
              inputTokens: 10,
              latencyMs: 500,
              outputTokens: 20,
              projectId: "project-1",
              projectTopicId: "topic-1",
              promptText: "How visible is Acme?",
              providerId: "chatgpt",
              providerModel: "gpt-5",
              rawResponseJson: null,
              rawResponseText: "Acme is visible.",
              respondedAt: "2026-04-21T12:02:00.000Z",
              responseSummary: "Acme is visible.",
              status: "completed",
              trackedPromptId: "tracked-prompt-1",
            },
          ],
          status: "completed",
          trackedPromptId: "tracked-prompt-1",
        },
      ],
      scheduledFor: "2026-04-21T12:00:00.000Z",
      startedAt: "2026-04-21T12:00:00.000Z",
      trackedPrompts: [],
      triggerType: "manual",
    })

    expect(brandEntitiesBuilder.insert).not.toHaveBeenCalled()
    expect(promptRunsBuilder.insert).toHaveBeenCalledOnce()
    expect(promptRunResponsesBuilder.insert).toHaveBeenCalledOnce()
    expect(responseBrandMetricsBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        brand_entity_id: "brand-1",
        response_id: "response-1",
      }),
    ])
    expect(result).toEqual({
      promptRunCount: 1,
      responseCount: 1,
    })
  })
})
