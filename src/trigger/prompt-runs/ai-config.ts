import {
  getAnthropicWebSearchTool,
  getOpenAiWebSearchTool,
  type ProviderId,
} from "@/lib/ai/provider-config"

export const PROMPT_RUN_ANALYSIS_MODEL_ID = "openai/gpt-5.4"
export const PROMPT_RUN_MODEL_IDS = {
  chatgpt: "openai/gpt-5.4-mini",
  claude: "anthropic/claude-sonnet-4.6",
  perplexity: "perplexity/sonar",
} as const

// Return plain "provider/model" strings so the AI SDK resolves them through
// the default AI Gateway registry. That path supports provider-defined tools
// (e.g. `anthropic.tools.webSearch_20250305`) as of @ai-sdk/anthropic@3.x.
// https://vercel.com/docs/ai-gateway/capabilities/web-search
export function getPromptRunModel(providerId: "chatgpt" | "claude" | "perplexity") {
  return PROMPT_RUN_MODEL_IDS[providerId]
}

export function getPromptRunAnalysisModel() {
  return PROMPT_RUN_ANALYSIS_MODEL_ID
}

export function getPromptRunTools(
  providerId: "chatgpt" | "claude" | "perplexity"
) {
  switch (providerId) {
    case "chatgpt":
      return {
        web_search: getOpenAiWebSearchTool(),
      }
    case "claude":
      return {
        web_search: getAnthropicWebSearchTool({
          maxUses: 5,
          userLocation: {
            type: "approximate",
            country: "US",
          },
        }),
      }
    case "perplexity":
      return undefined
  }
}

export function toProviderRegistryId(
  providerId: "chatgpt" | "claude" | "perplexity"
): ProviderId {
  switch (providerId) {
    case "chatgpt":
      return "openai"
    case "claude":
      return "anthropic"
    case "perplexity":
      return "perplexity"
  }
}
