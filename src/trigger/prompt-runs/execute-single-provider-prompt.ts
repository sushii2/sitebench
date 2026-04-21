import { generateText, stepCountIs } from "ai"
import { AbortTaskRunError, logger, queue, retry, task } from "@trigger.dev/sdk"

import { extractCitations } from "@/lib/prompt-runs/analysis"
import { getPerplexityErrorCode } from "@/lib/prompt-runs/analysis"
import { getPromptRunModel, getPromptRunTools } from "@/src/trigger/prompt-runs/ai-config"
import type {
  ProviderExecutionPayload,
  ProviderExecutionResult,
} from "@/src/trigger/prompt-runs/shared"

export const promptRunProviderQueues = {
  chatgpt: queue({
    concurrencyLimit: 5,
    name: "prompt-runs-chatgpt",
  }),
  claude: queue({
    concurrencyLimit: 5,
    name: "prompt-runs-claude",
  }),
  perplexity: queue({
    concurrencyLimit: 2,
    name: "prompt-runs-perplexity",
  }),
} as const

const MAX_RAW_RESPONSE_TEXT_CHARS = 32_000
const MAX_RAW_RESPONSE_JSON_BYTES = 96_000

function safeSerialize(value: unknown) {
  try {
    return JSON.parse(JSON.stringify(value)) as Record<string, unknown>
  } catch {
    return null
  }
}

function truncateText(value: string | null | undefined, maxChars: number) {
  if (!value) {
    return value ?? null
  }

  return value.length > maxChars
    ? `${value.slice(0, maxChars)}\n\n[truncated]`
    : value
}

function capJsonEnvelope(value: Record<string, unknown> | null, maxBytes: number) {
  if (!value) {
    return null
  }

  try {
    const serialized = JSON.stringify(value)

    if (serialized.length <= maxBytes) {
      return value
    }

    return {
      ...value,
      response: undefined,
      truncated: true,
    }
  } catch {
    return null
  }
}

function classifyProviderFailure(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const normalized = message.toLowerCase()

  if (normalized.includes("429") || normalized.includes("rate limit")) {
    return {
      errorCode: "rate_limited",
      retryable: true,
      status: "rate_limited" as const,
    }
  }

  if (normalized.includes("timeout")) {
    return {
      errorCode: "timeout",
      retryable: true,
      status: "timeout" as const,
    }
  }

  if (normalized.includes("blocked")) {
    return {
      errorCode: "blocked",
      retryable: false,
      status: "blocked" as const,
    }
  }

  const isPermanentFailure =
    normalized.includes("model not found") ||
    normalized.includes("model_not_found") ||
    normalized.includes("invalid api key") ||
    normalized.includes("invalid_api_key") ||
    normalized.includes("unauthorized") ||
    normalized.includes("unsupported tool type") ||
    normalized.includes("no such tool") ||
    normalized.includes(" 401") ||
    normalized.includes(" 403") ||
    normalized.includes(" 404")

  const isRetryableServerError =
    normalized.includes(" 500") ||
    normalized.includes(" 502") ||
    normalized.includes(" 503") ||
    normalized.includes(" 504") ||
    normalized.includes("econnreset") ||
    normalized.includes("etimedout") ||
    normalized.includes("enotfound") ||
    normalized.includes("socket hang up") ||
    normalized.includes("fetch failed") ||
    normalized.includes("network error")

  return {
    errorCode: getPerplexityErrorCode(message),
    retryable: !isPermanentFailure && isRetryableServerError,
    status: "failed" as const,
  }
}

export const executeSingleProviderPrompt = task({
  id: "prompt-runs.execute-single-provider",
  maxDuration: 600,
  queue: {
    concurrencyLimit: 5,
  },
  retry: {
    maxAttempts: 1,
  },
  run: async (payload: ProviderExecutionPayload): Promise<ProviderExecutionResult> => {
    const startedAt = Date.now()

    logger.info("[prompt-runs] Provider execution started", {
      projectId: payload.projectId,
      providerId: payload.providerId,
      trackedPromptId: payload.trackedPromptId,
    })

    try {
      const result = await retry.onThrow(
        async ({ attempt }) => {
          try {
            return await generateText({
              model: getPromptRunModel(payload.providerId),
              onStepFinish({
                finishReason,
                stepNumber,
                toolCalls,
                toolResults,
                usage,
              }) {
                logger.info("[prompt-runs] Provider step finished", {
                  attempt,
                  finishReason,
                  providerId: payload.providerId,
                  stepNumber,
                  toolCallCount: toolCalls.length,
                  toolResultCount: toolResults.length,
                  trackedPromptId: payload.trackedPromptId,
                  usage,
                })
              },
              prompt: payload.promptText,
              providerOptions:
                payload.providerId === "chatgpt"
                  ? {
                      openai: {
                        parallelToolCalls: false,
                        store: false,
                        textVerbosity: "low",
                      },
                    }
                  : undefined,
              stopWhen: stepCountIs(6) as never,
              temperature: 0,
              tools: getPromptRunTools(payload.providerId) as never,
            })
          } catch (error) {
            const failure = classifyProviderFailure(error)

            logger.warn("[prompt-runs] Provider attempt failed", {
              attempt,
              errorCode: failure.errorCode,
              message: error instanceof Error ? error.message : String(error),
              providerId: payload.providerId,
              retryable: failure.retryable,
              status: failure.status,
              trackedPromptId: payload.trackedPromptId,
            })

            if (!failure.retryable) {
              throw new AbortTaskRunError(
                error instanceof Error ? error.message : String(error)
              )
            }

            throw error
          }
        },
        {
          factor: 2,
          maxAttempts: 3,
          maxTimeoutInMs: 30_000,
          minTimeoutInMs: 1_000,
          randomize: true,
        }
      )

      logger.info("[prompt-runs] Provider execution succeeded", {
        finishReason: result.finishReason,
        providerId: payload.providerId,
        trackedPromptId: payload.trackedPromptId,
      })

      const rawJsonEnvelope = safeSerialize({
        finishReason: result.finishReason,
        providerMetadata: result.providerMetadata,
        sources: result.sources,
        toolResults: result.toolResults,
      })

      return {
        citations: extractCitations({
          providerId: payload.providerId,
          providerMetadata: result.providerMetadata as Record<string, unknown> | undefined,
          rawResponseJson: rawJsonEnvelope,
          sources: result.sources,
          toolResults: result.toolResults,
        }),
        errorCode: null,
        errorMessage: null,
        inputTokens: result.usage.inputTokens ?? null,
        latencyMs: Date.now() - startedAt,
        outputTokens: result.usage.outputTokens ?? null,
        projectId: payload.projectId,
        projectTopicId: payload.projectTopicId,
        promptText: payload.promptText,
        providerId: payload.providerId,
        providerModel:
          safeSerialize(result.response)?.modelId as string | null | undefined ??
          null,
        rawResponseJson: capJsonEnvelope(rawJsonEnvelope, MAX_RAW_RESPONSE_JSON_BYTES),
        rawResponseText: truncateText(result.text, MAX_RAW_RESPONSE_TEXT_CHARS),
        respondedAt: new Date().toISOString(),
        status: "completed",
        trackedPromptId: payload.trackedPromptId,
      }
    } catch (error) {
      const failure = classifyProviderFailure(error)

      logger.error("[prompt-runs] Provider execution failed", {
        error: error instanceof Error ? error.message : error,
        providerId: payload.providerId,
        trackedPromptId: payload.trackedPromptId,
      })

      return {
        citations: [],
        errorCode: failure.errorCode,
        errorMessage: error instanceof Error ? error.message : String(error),
        inputTokens: null,
        latencyMs: Date.now() - startedAt,
        outputTokens: null,
        projectId: payload.projectId,
        projectTopicId: payload.projectTopicId,
        promptText: payload.promptText,
        providerId: payload.providerId,
        providerModel: null,
        rawResponseJson: null,
        rawResponseText: null,
        respondedAt: new Date().toISOString(),
        status: failure.status,
        trackedPromptId: payload.trackedPromptId,
      }
    }
  },
})
