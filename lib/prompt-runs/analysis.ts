import type { PromptRunProviderId } from "@/lib/prompt-run-configs/types"

export interface NormalizedCitation {
  url: string
  title: string | null
  citationOrder: number | null
  text: string | null
}

function takeObject(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null
}

function takeArray(value: unknown) {
  return Array.isArray(value) ? value : []
}

function takeString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null
}

function toCitation(
  value: unknown,
  citationOrder: number
): NormalizedCitation | null {
  if (typeof value === "string") {
    const url = normalizeCitation(value)

    return url
      ? {
          citationOrder,
          text: null,
          title: null,
          url,
        }
      : null
  }

  const candidate = takeObject(value)

  if (!candidate) {
    return null
  }

  const url = normalizeCitation(
    takeString(candidate.url) ??
      takeString(candidate.link) ??
      takeString(candidate.cited_url)
  )

  if (!url) {
    return null
  }

  return {
    citationOrder,
    text:
      takeString(candidate.text) ??
      takeString(candidate.snippet) ??
      takeString(candidate.citation_text),
    title:
      takeString(candidate.title) ??
      takeString(candidate.page_title) ??
      takeString(candidate.name),
    url,
  }
}

function dedupeCitations(citations: NormalizedCitation[]) {
  const deduped: NormalizedCitation[] = []
  const seen = new Set<string>()

  for (const citation of citations) {
    const key = citation.url

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    deduped.push(citation)
  }

  return deduped
}

export function normalizeCitation(value: string | null | undefined) {
  if (!value) {
    return null
  }

  try {
    const url = new URL(value)

    url.hash = ""
    url.searchParams.sort()

    const pathname =
      url.pathname !== "/" ? url.pathname.replace(/\/+$/g, "") || "/" : "/"

    url.hostname = url.hostname.toLowerCase().replace(/^www\./i, "")
    url.pathname = pathname

    return url.toString()
  } catch {
    return null
  }
}

export function computeShareOfVoice(mentionCount: number, totalMentions: number) {
  if (mentionCount <= 0 || totalMentions <= 0) {
    return 0
  }

  return Number(((mentionCount / totalMentions) * 100).toFixed(2))
}

export function extractCitations(input: {
  providerId: PromptRunProviderId
  providerMetadata?: Record<string, unknown> | undefined
  rawResponseJson?: Record<string, unknown> | null
  sources?: unknown
  toolResults?: unknown
}): NormalizedCitation[] {
  const citations: NormalizedCitation[] = []

  if (input.providerId === "chatgpt") {
    for (const [index, source] of takeArray(input.sources).entries()) {
      const citation = toCitation(source, index + 1)

      if (citation) {
        citations.push(citation)
      }
    }

    return dedupeCitations(citations)
  }

  if (input.providerId === "claude") {
    for (const toolResult of takeArray(input.toolResults)) {
      const candidate = takeObject(toolResult)
      const output = candidate?.output

      for (const [index, item] of takeArray(output).entries()) {
        const citation = toCitation(item, index + 1)

        if (citation) {
          citations.push(citation)
        }
      }
    }

    const anthropicMetadata = takeObject(input.providerMetadata?.anthropic)
    const webSearchResults = takeArray(anthropicMetadata?.webSearchResults)

    for (const [index, result] of webSearchResults.entries()) {
      const citation = toCitation(result, index + 1)

      if (citation) {
        citations.push(citation)
      }
    }

    return dedupeCitations(citations)
  }

  const rawCitations = takeArray(
    takeObject(input.providerMetadata?.perplexity)?.citations ??
      takeObject(input.rawResponseJson)?.citations
  )

  for (const [index, result] of rawCitations.entries()) {
    const citation = toCitation(result, index + 1)

    if (citation) {
      citations.push(citation)
    }
  }

  return dedupeCitations(citations)
}

export function getCitationDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "")
  } catch {
    return null
  }
}

export function getCitationRootDomain(url: string) {
  const domain = getCitationDomain(url)

  if (!domain) {
    return null
  }

  const parts = domain.split(".")

  if (parts.length <= 2) {
    return domain
  }

  return parts.slice(-2).join(".")
}

export function getPerplexityErrorCode(errorMessage: string | null) {
  const message = errorMessage?.toLowerCase() ?? ""

  if (message.includes("429") || message.includes("rate limit")) {
    return "rate_limited"
  }

  if (message.includes("timeout")) {
    return "timeout"
  }

  if (message.includes("blocked")) {
    return "blocked"
  }

  return takeString(errorMessage)
}
