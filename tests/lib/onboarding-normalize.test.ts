import { describe, expect, it } from "vitest"

import {
  buildFallbackOnboardingSuggestions,
  postProcessOnboardingSuggestions,
} from "@/lib/onboarding/normalize"

describe("onboarding normalization", () => {
  it("trims descriptions, lowercases topics, and caps competitors", () => {
    const result = postProcessOnboardingSuggestions(
      {
        competitors: [
          { name: " Competitor 1 ", website: "competitor-1.com/pricing" },
          { name: "Competitor 2", website: "https://competitor-2.com" },
          { name: "Competitor 3", website: "https://competitor-3.com" },
          { name: "Competitor 4", website: "https://competitor-4.com" },
          { name: "Competitor 5", website: "https://competitor-5.com" },
          { name: "Competitor 6", website: "https://competitor-6.com" },
        ],
        description: ` ${"A".repeat(510)} `,
        topics: ["  AI Search  ", "ai search", "Perplexity", "Brand Search"],
      },
      "https://acme.com"
    )

    expect(result.description).toHaveLength(500)
    expect(result.topics).toEqual(["ai search", "perplexity", "brand search"])
    expect(result.competitors).toHaveLength(5)
    expect(result.competitors[0]).toEqual({
      name: "Competitor 1",
      website: "https://competitor-1.com",
    })
  })

  it("drops invalid and self competitors while preserving partial warnings", () => {
    const result = postProcessOnboardingSuggestions(
      {
        competitors: [
          { name: "Acme", website: "https://acme.com" },
          { name: "Broken", website: "foo" },
          { name: "Competitor 1", website: "https://competitor-1.com" },
        ],
        description: "",
        topics: ["AI Search"],
      },
      "https://acme.com"
    )

    expect(result.competitors).toEqual([
      {
        name: "Competitor 1",
        website: "https://competitor-1.com",
      },
    ])
    expect(result.warnings).toEqual([
      "We could not suggest a description. Please add one manually.",
      "We found fewer than 3 strong topics. Review and add topics before continuing.",
      "We found fewer than 4 competitors. Review and add competitors if needed.",
    ])
  })

  it("builds a metadata-only fallback when AI normalization is unavailable", () => {
    const result = buildFallbackOnboardingSuggestions(
      {
        html: "<html><body><h1>Acme</h1><p>Acme helps teams measure brand visibility in AI answers.</p></body></html>",
        markdown:
          "# Acme\n\nAcme helps teams measure brand visibility in AI answers.\n\nCompare prompts across models.",
        url: "https://acme.com",
      },
      "https://acme.com"
    )

    expect(result.description).toBe(
      "Acme helps teams measure brand visibility in AI answers. Compare prompts across models."
    )
    expect(result.topics).toEqual([])
    expect(result.competitors).toEqual([])
    expect(result.warnings).toContain(
      "We found fewer than 4 competitors. Review and add competitors if needed."
    )
  })
})
