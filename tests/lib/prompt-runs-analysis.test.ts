import { describe, expect, it } from "vitest"

import {
  computeShareOfVoice,
  extractCitations,
  normalizeCitation,
} from "@/lib/prompt-runs/analysis"

describe("prompt run analysis helpers", () => {
  it("normalizes citation urls", () => {
    expect(
      normalizeCitation("https://www.example.com/path/?b=2&a=1#section")
    ).toBe("https://example.com/path?a=1&b=2")
  })

  it("computes share of voice percentages", () => {
    expect(computeShareOfVoice(3, 12)).toBe(25)
    expect(computeShareOfVoice(0, 12)).toBe(0)
  })

  it("extracts citations from OpenAI sources", () => {
    expect(
      extractCitations({
        providerId: "chatgpt",
        sources: [
          {
            title: "Acme",
            url: "https://acme.test/platform",
          },
        ],
      })
    ).toEqual([
      {
        citationOrder: 1,
        text: null,
        title: "Acme",
        url: "https://acme.test/platform",
      },
    ])
  })

  it("extracts citations from Anthropic tool results", () => {
    expect(
      extractCitations({
        providerId: "claude",
        toolResults: [
          {
            output: [
              {
                title: "Anthropic result",
                url: "https://anthropic.test/result",
              },
            ],
          },
        ],
      })
    ).toEqual([
      {
        citationOrder: 1,
        text: null,
        title: "Anthropic result",
        url: "https://anthropic.test/result",
      },
    ])
  })

  it("extracts citations from Perplexity metadata", () => {
    expect(
      extractCitations({
        providerId: "perplexity",
        providerMetadata: {
          perplexity: {
            citations: [
              {
                text: "Snippet",
                title: "Perplexity citation",
                url: "https://perplexity.test/citation",
              },
            ],
          },
        },
      })
    ).toEqual([
      {
        citationOrder: 1,
        text: "Snippet",
        title: "Perplexity citation",
        url: "https://perplexity.test/citation",
      },
    ])
  })
})
