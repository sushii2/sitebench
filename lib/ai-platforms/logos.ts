import { buildBrandLogoUrl } from "@/lib/brands/logo"

const PLATFORM_DOMAINS: Record<string, string> = {
  chatgpt: "chatgpt.com",
  claude: "claude.ai",
  perplexity: "perplexity.ai",
  gemini: "gemini.google.com",
  copilot: "copilot.microsoft.com",
  grok: "x.ai",
  meta: "meta.ai",
}

export function getPlatformDomain(code: string): string | null {
  return PLATFORM_DOMAINS[code.toLowerCase()] ?? null
}

export function buildPlatformLogoUrl(
  code: string,
  publishableKey: string | null
): string | null {
  const domain = getPlatformDomain(code)

  if (!domain || !publishableKey) {
    return null
  }

  return buildBrandLogoUrl(domain, publishableKey)
}
