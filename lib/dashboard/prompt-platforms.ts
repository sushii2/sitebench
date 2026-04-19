export type PromptPlatformId = "chatgpt" | "claude" | "perplexity"

export interface PromptPlatform {
  id: PromptPlatformId
  label: string
  domain: string
}

export const PROMPT_PLATFORMS: PromptPlatform[] = [
  { id: "chatgpt", label: "ChatGPT", domain: "chatgpt.com" },
  { id: "claude", label: "Claude", domain: "claude.ai" },
  { id: "perplexity", label: "Perplexity", domain: "perplexity.ai" },
]
