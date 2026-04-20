import { asSchema, type FlexibleSchema } from "ai"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
  getAnthropicWebSearchToolMock,
  createGatewayStructuredObjectOutputMock,
  generateTextMock,
  getLanguageModelMock,
  getOpenAiWebSearchToolMock,
  stepCountIsMock,
} = vi.hoisted(() => ({
  getAnthropicWebSearchToolMock: vi.fn(() => ({
    type: "anthropic_web_search",
  })),
  createGatewayStructuredObjectOutputMock: vi.fn((options) => options),
  generateTextMock: vi.fn(),
  getLanguageModelMock: vi.fn(
    (_providerId: string, options?: { capability?: string; modelId?: string }) => ({
      capability: options?.capability ?? "default",
      modelId: options?.modelId ?? "default-model",
      provider: "gateway",
    })
  ),
  getOpenAiWebSearchToolMock: vi.fn(() => ({
    type: "openai_web_search",
  })),
  stepCountIsMock: vi.fn((count: number) => ({
    count,
    type: "stepCountIs",
  })),
}))

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai")

  return {
    ...actual,
    generateText: generateTextMock,
    stepCountIs: stepCountIsMock,
  }
})

vi.mock("@/lib/ai/gateway-structured-output", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/ai/gateway-structured-output")
  >("@/lib/ai/gateway-structured-output")

  return {
    ...actual,
    createGatewayStructuredObjectOutput: createGatewayStructuredObjectOutputMock,
  }
})

vi.mock("@/lib/ai/provider-config", () => ({
  getAnthropicWebSearchTool: getAnthropicWebSearchToolMock,
  getLanguageModel: getLanguageModelMock,
  getOpenAiWebSearchTool: getOpenAiWebSearchToolMock,
}))

class FakeStepResult {
  content = [
    {
      text: "hello world",
      type: "text",
    },
  ]
  experimental_context = undefined
  finishReason = "stop"
  functionId = undefined
  metadata = undefined
  model = {
    modelId: "perplexity/sonar",
    provider: "gateway",
  }
  providerMetadata = {
    gateway: {
      requestId: "request-1",
    },
  }
  rawFinishReason = "stop"
  request = {
    body: {
      prompt: "hi",
    },
  }
  response = {
    id: "response-1",
    timestamp: new Date("2026-04-20T20:20:56.951Z"),
  }
  stepNumber = 0
  usage = {
    inputTokens: 12,
    outputTokens: 34,
    totalTokens: 46,
  }
  warnings: unknown[] = []

  get text() {
    return "hello world"
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("serializeGenerateTextResult", () => {
  it("converts nested step results into plain JSON-safe objects", async () => {
    const { serializeGenerateTextResult } = await import(
      "@/lib/prompt-pipeline/ai"
    )

    const stepResult = new FakeStepResult()
    const serialized = serializeGenerateTextResult({
      response: {
        timestamp: new Date("2026-04-20T20:20:56.951Z"),
      },
      steps: [stepResult],
      text: "hello world",
      totalUsage: {
        inputTokens: 12,
        outputTokens: 34,
      },
    })

    expect(serialized).toMatchObject({
      response: {
        timestamp: "2026-04-20T20:20:56.951Z",
      },
      text: "hello world",
      totalUsage: {
        inputTokens: 12,
        outputTokens: 34,
      },
    })

    const serializedStep = (serialized?.steps as Record<string, unknown>[])[0]

    expect(serializedStep).toEqual(
      expect.objectContaining({
        finishReason: "stop",
        stepNumber: 0,
      })
    )
    expect(Object.getPrototypeOf(serializedStep)).toBe(Object.prototype)
    expect(serializedStep).not.toBe(stepResult)
    expect((serializedStep.response as Record<string, unknown>).timestamp).toBe(
      "2026-04-20T20:20:56.951Z"
    )
  })
})

describe("parsePromptPlatformResult", () => {
  it("passes a Gateway-compatible root schema to structured output", async () => {
    generateTextMock.mockResolvedValue({
      output: {
        brands: [],
        citations: [],
        warnings: [],
      },
    })

    const { parsePromptPlatformResult } = await import(
      "@/lib/prompt-pipeline/ai"
    )

    await parsePromptPlatformResult({
      promptText: "Which brands are visible for trail running shoes?",
      rawResponseJson: null,
      rawResponseText: "No brands mentioned.",
    })

    expect(createGatewayStructuredObjectOutputMock).toHaveBeenCalledTimes(1)

    const [options] = createGatewayStructuredObjectOutputMock.mock.calls[0] as [
      { schema: FlexibleSchema<unknown> },
    ]
    const jsonSchema = asSchema(options.schema).jsonSchema as {
      additionalProperties?: unknown
      properties?: Record<string, unknown>
      required?: string[]
    }

    expect(jsonSchema.additionalProperties).toBe(false)
    expect(Object.keys(jsonSchema.properties ?? {}).sort()).toEqual([
      "brands",
      "citations",
      "warnings",
    ])
    expect([...(jsonSchema.required ?? [])].sort()).toEqual([
      "brands",
      "citations",
      "warnings",
    ])
  })
})

describe("runPromptOnPlatform", () => {
  it.each([
    {
      expectedModelId: "openai/gpt-5.4-mini",
      platformCode: "chatgpt" as const,
      toolType: "openai_web_search",
    },
    {
      expectedModelId: "anthropic/claude-sonnet-4.6",
      platformCode: "claude" as const,
      toolType: "anthropic_web_search",
    },
  ])(
    "configures single-search loop control for $platformCode",
    async ({ expectedModelId, platformCode, toolType }) => {
      generateTextMock.mockResolvedValue({
        text: "Answer with sources.",
        totalUsage: {
          inputTokens: 11,
          outputTokens: 22,
        },
      })

      const { runPromptOnPlatform } = await import("@/lib/prompt-pipeline/ai")

      const result = await runPromptOnPlatform(
        platformCode,
        "Which AI visibility vendors are recommended?"
      )

      expect(result.rawResponseText).toBe("Answer with sources.")
      expect(stepCountIsMock).toHaveBeenCalledWith(3)
      expect(generateTextMock).toHaveBeenCalledTimes(1)

      const [call] = generateTextMock.mock.calls as [Array<Record<string, unknown>>]
      const options = call[0]

      expect(options.model).toEqual({
        capability: "webSearch",
        modelId: expectedModelId,
        provider: "gateway",
      })
      expect(options.toolChoice).toEqual({
        toolName: "web_search",
        type: "tool",
      })
      expect(options.tools).toEqual({
        web_search: {
          type: toolType,
        },
      })
      expect(options.stopWhen).toEqual({
        count: 3,
        type: "stepCountIs",
      })
      expect(options.prepareStep).toBeTypeOf("function")
      expect(
        (options.prepareStep as (input: {
          stepNumber: number
          steps: Array<{
            toolCalls: Array<{ toolName: string }>
            toolResults: Array<{ toolName: string }>
          }>
        }) => Record<string, unknown>)({
          stepNumber: 1,
          steps: [
            {
              toolCalls: [{ toolName: "web_search" }],
              toolResults: [{ toolName: "web_search" }],
            },
          ],
        })
      ).toEqual({
        activeTools: [],
      })
    }
  )

  it("does not attach tool loop control to perplexity", async () => {
    generateTextMock.mockResolvedValue({
      text: "Perplexity answer.",
      totalUsage: {
        inputTokens: 5,
        outputTokens: 7,
      },
    })

    const { runPromptOnPlatform } = await import("@/lib/prompt-pipeline/ai")

    await runPromptOnPlatform(
      "perplexity",
      "Which AI visibility vendors are recommended?"
    )

    const [call] = generateTextMock.mock.calls as [Array<Record<string, unknown>>]
    const options = call[0]

    expect(options.model).toEqual({
      capability: "webSearch",
      modelId: "perplexity/sonar",
      provider: "gateway",
    })
    expect(options.tools).toBeUndefined()
    expect(options.stopWhen).toBeUndefined()
    expect(options.prepareStep).toBeUndefined()
  })
})
