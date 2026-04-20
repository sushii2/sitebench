import {
  generateText,
  stepCountIs,
  type PrepareStepFunction,
  type StopCondition,
  type ToolSet,
} from "ai"
import { z } from "zod"

import { createGatewayStructuredObjectOutput } from "@/lib/ai/gateway-structured-output"
import {
  getAnthropicWebSearchTool,
  getLanguageModel,
  getOpenAiWebSearchTool,
} from "@/lib/ai/provider-config"

const PROMPT_PIPELINE_SYSTEM_PROMPT = [
  "Answer the user query directly.",
  "Use web search when supported by the provider.",
  "Cite factual claims with the linked sources returned by the model.",
  "Do not invent citations or competitors.",
].join(" ")

const promptPipelineParserSchema = z.object({
  brands: z
    .array(
      z.object({
        canonicalWebsite: z.string().trim().nullable(),
        name: z.string().trim().min(1),
        recommendationStatus: z.enum([
          "recommended",
          "mentioned",
          "not_recommended",
        ]),
        sentimentLabel: z.enum(["positive", "neutral", "negative", "mixed"]),
        visibilityScore: z.number().min(0).max(100),
      })
    ),
  citations: z
    .array(
      z.object({
        authorityScore: z.number().nullable(),
        citationText: z.string().trim().nullable(),
        pageTitle: z.string().trim().nullable(),
        url: z.string().trim().min(1),
      })
    ),
  warnings: z.array(z.string().trim()),
})

type PromptPipelinePlatformCode = "chatgpt" | "claude" | "perplexity"
const PROMPT_PIPELINE_SEARCH_MAX_STEPS = 3

function createSingleSearchTextLoopControl<TOOLS extends ToolSet>(tools: TOOLS): {
  prepareStep: PrepareStepFunction<TOOLS>
  stopWhen: StopCondition<TOOLS>
} {
  void tools

  const prepareStep: PrepareStepFunction<TOOLS> = ({ stepNumber, steps }) => {
    const hasCompletedSearch = steps.some((step) =>
      step.toolCalls.some((toolCall) => toolCall.toolName === "web_search")
    )

    if (!hasCompletedSearch) {
      return {}
    }

    console.log("[prompt-pipeline] Search completed; disabling tools for synthesis", {
      priorStepCount: steps.length,
      stepNumber,
    })

    return {
      activeTools: [],
    }
  }

  return {
    prepareStep,
    stopWhen: stepCountIs(PROMPT_PIPELINE_SEARCH_MAX_STEPS) as StopCondition<TOOLS>,
  }
}

function toSerializableRecord(value: unknown) {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null
}

function toSerializableJsonValue<T>(value: T) {
  try {
    return JSON.parse(JSON.stringify(value)) as T
  } catch {
    return null
  }
}

function toTokenCount(value: unknown, key: string) {
  if (typeof value !== "object" || value === null) {
    return null
  }

  const nestedValue = (value as Record<string, unknown>)[key]

  return typeof nestedValue === "number" ? nestedValue : null
}

export function serializeGenerateTextResult(result: unknown) {
  const record = toSerializableRecord(result)

  if (!record) {
    return null
  }

  const snapshot: Record<string, unknown> = {}

  for (const key of [
    "content",
    "text",
    "reasoning",
    "files",
    "sources",
    "toolCalls",
    "toolResults",
    "finishReason",
    "rawFinishReason",
    "usage",
    "totalUsage",
    "warnings",
    "request",
    "response",
    "providerMetadata",
    "steps",
    "output",
  ]) {
    snapshot[key] = record[key] ?? null
  }

  return toSerializableRecord(toSerializableJsonValue(snapshot))
}

export async function runPromptOnPlatform(
  platformCode: PromptPipelinePlatformCode,
  promptText: string
) {
  const startedAt = Date.now()
  console.log("[prompt-pipeline] Running prompt on platform", {
    platformCode,
    promptLength: promptText.length,
  })
  const result =
    platformCode === "chatgpt"
      ? await (() => {
          const tools = {
            web_search: getOpenAiWebSearchTool(),
          }

          return generateText({
            model: getLanguageModel("openai", {
              capability: "webSearch",
              modelId: "openai/gpt-5.4-mini",
            }),
            onStepFinish({ finishReason, stepNumber, text, toolCalls, toolResults, usage }) {
              console.log("[prompt-pipeline] Platform step finished", {
                finishReason,
                platformCode,
                stepNumber,
                textLength: text.length,
                toolCallCount: toolCalls.length,
                toolResultCount: toolResults.length,
                usage,
              })
            },
            prompt: promptText,
            system: PROMPT_PIPELINE_SYSTEM_PROMPT,
            temperature: 0,
            toolChoice: { type: "tool", toolName: "web_search" },
            tools,
            ...createSingleSearchTextLoopControl(tools),
          })
        })()
      : platformCode === "claude"
        ? await (() => {
            const tools = {
              web_search: getAnthropicWebSearchTool() as never,
            }

            return generateText({
              model: getLanguageModel("anthropic", {
                capability: "webSearch",
                modelId: "anthropic/claude-sonnet-4.6",
              }),
              onStepFinish({ finishReason, stepNumber, text, toolCalls, toolResults, usage }) {
                console.log("[prompt-pipeline] Platform step finished", {
                  finishReason,
                  platformCode,
                  stepNumber,
                  textLength: text.length,
                  toolCallCount: toolCalls.length,
                  toolResultCount: toolResults.length,
                  usage,
                })
              },
              prompt: promptText,
              system: PROMPT_PIPELINE_SYSTEM_PROMPT,
              temperature: 0,
              toolChoice: { type: "tool", toolName: "web_search" },
              tools,
              ...createSingleSearchTextLoopControl(tools),
            })
          })()
        : await generateText({
            model: getLanguageModel("perplexity", {
              capability: "webSearch",
              modelId: "perplexity/sonar",
            }),
            onStepFinish({ finishReason, stepNumber, text, toolCalls, toolResults, usage }) {
              console.log("[prompt-pipeline] Platform step finished", {
                finishReason,
                platformCode,
                stepNumber,
                textLength: text.length,
                toolCallCount: toolCalls.length,
                toolResultCount: toolResults.length,
                usage,
              })
            },
            prompt: promptText,
            system: PROMPT_PIPELINE_SYSTEM_PROMPT,
            temperature: 0,
          })
  const serialized = serializeGenerateTextResult(result)
  const totalUsage = toSerializableRecord(serialized?.totalUsage)

  console.log("[prompt-pipeline] Prompt completed on platform", {
    hasRawText: typeof serialized?.text === "string",
    inputTokens: toTokenCount(totalUsage, "inputTokens"),
    latencyMs: Date.now() - startedAt,
    outputTokens: toTokenCount(totalUsage, "outputTokens"),
    platformCode,
    sourceCount: Array.isArray(serialized?.sources) ? serialized.sources.length : 0,
    toolResultCount: Array.isArray(serialized?.toolResults)
      ? serialized.toolResults.length
      : 0,
  })

  return {
    inputTokens: toTokenCount(totalUsage, "inputTokens"),
    latencyMs: Date.now() - startedAt,
    modelId:
      platformCode === "chatgpt"
        ? "openai/gpt-5.4-mini"
        : platformCode === "claude"
          ? "anthropic/claude-sonnet-4.6"
          : "perplexity/sonar",
    outputTokens: toTokenCount(totalUsage, "outputTokens"),
    platformCode,
    rawResponseJson: serialized,
    rawResponseText:
      typeof serialized?.text === "string" ? serialized.text : null,
  }
}

function buildParserPrompt(input: {
  promptText: string
  rawResponseText: string | null
  sources: unknown
}) {
  return JSON.stringify(
    {
      promptText: input.promptText,
      rawResponseText: input.rawResponseText,
      sources: input.sources,
    },
    null,
    2
  )
}

export async function parsePromptPlatformResult(input: {
  promptText: string
  rawResponseJson: Record<string, unknown> | null
  rawResponseText: string | null
}) {
  const { output } = await generateText({
    model: getLanguageModel("openai", {
      capability: "structuredOutput",
      modelId: "openai/gpt-5.4-mini",
    }),
    output: createGatewayStructuredObjectOutput({
      description:
        "Normalize the provider answer into brands and citations that can be stored in the replay view.",
      name: "prompt_pipeline_parser",
      schema: promptPipelineParserSchema,
    }),
    prompt: buildParserPrompt({
      promptText: input.promptText,
      rawResponseText: input.rawResponseText,
      sources: input.rawResponseJson?.sources ?? input.rawResponseJson?.toolResults ?? [],
    }),
    system: [
      "Extract only evidence present in the provider response and its linked sources.",
      "Use empty arrays when nothing reliable can be extracted.",
      "Do not fabricate citations, brands, or websites.",
    ].join(" "),
    temperature: 0,
  })

  return promptPipelineParserSchema.parse(output)
}
