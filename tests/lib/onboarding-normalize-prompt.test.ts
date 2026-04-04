import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGenerateText = vi.fn()
const mockGetLanguageModel = vi.fn(
  (_providerId: string, options?: { capability?: string }) => ({
    capability: options?.capability ?? "default",
    provider: "gateway",
  })
)

vi.mock("ai", () => ({
  Output: {
    object: ({ schema }: { schema: unknown }) => ({ schema }),
  },
  generateText: mockGenerateText,
}))

vi.mock("@/lib/ai/provider-config", () => ({
  getLanguageModel: mockGetLanguageModel,
}))

async function loadNormalizeModule() {
  return import("@/lib/onboarding/normalize")
}

describe("normalizeBrandOnboarding", () => {
  beforeEach(() => {
    vi.resetModules()
    mockGenerateText.mockReset()
    mockGetLanguageModel.mockClear()
  })

  it("uses raw markdown for tier 1 and conditionally augments competitors in tier 2", async () => {
    mockGenerateText.mockResolvedValue({
      output: {
        competitors: [
          { name: "Competitor 1", website: "competitor-1.com" },
          { name: "Acme", website: "https://acme.com" },
        ],
        description: ` ${"A".repeat(520)} `,
        topics: [
          "Best AI visibility platforms",
          "best ai visibility platforms",
          "How to improve brand citations in ChatGPT",
        ],
      },
    })
    mockGenerateText.mockResolvedValueOnce({
      output: {
        competitors: [
          { name: "Competitor 1", website: "competitor-1.com" },
        ],
        description: ` ${"A".repeat(520)} `,
        topics: [
          "Best AI visibility platforms",
          "best ai visibility platforms",
          "How to improve brand citations in ChatGPT",
        ],
      },
    })
    mockGenerateText.mockResolvedValueOnce({
      output: {
        competitors: [
          { name: "Competitor 2", website: "https://competitor-2.com" },
          { name: "Competitor 3", website: "https://competitor-3.com" },
          { name: "Competitor 4", website: "https://competitor-4.com" },
          { name: "Competitor 5", website: "https://competitor-5.com" },
        ],
      },
      sources: [{ url: "https://example.com/results" }],
    })

    const { normalizeBrandOnboarding } = await loadNormalizeModule()

    const result = await normalizeBrandOnboarding({
      companyName: "Acme",
      context: {
        html: "<html><body><h1>Acme</h1><p>Measure brand visibility across AI answers.</p></body></html>",
        markdown: "# Acme\nMeasure brand visibility across AI answers.",
        url: "https://acme.com",
      },
      website: "https://acme.com",
    })

    expect(mockGenerateText).toHaveBeenCalledTimes(2)

    const [tierOneCall, tierTwoCall] = mockGenerateText.mock.calls
    expect(tierOneCall[0].system).toContain(
      "You are an expert GEO/AEO onboarding analysis assistant."
    )
    expect(tierOneCall[0].system).toContain(
      "return only the onboarding fields required by the schema: description, topics, and competitors"
    )
    expect(tierOneCall[0].system).toContain(
      "Topics must be natural AI-search monitoring themes"
    )
    expect(tierOneCall[0].system).toContain(
      "Do not treat customers, partners, integrations, investors, marketplaces, publishers, agencies, or adjacent tools as competitors"
    )
    expect(tierOneCall[0].system).toContain(
      "IMPORTANT: Principles: Validate outcomes, iterate if needed, efficiency."
    )
    expect(mockGetLanguageModel).toHaveBeenNthCalledWith(1, "openai", {
      capability: "structuredOutput",
    })
    expect(tierOneCall[0].model).toEqual({
      capability: "structuredOutput",
      provider: "gateway",
    })
    expect(tierOneCall[0].prompt).toContain("Homepage URL: https://acme.com")
    expect(tierOneCall[0].prompt).toContain(
      "Homepage HTML:\n<html><body><h1>Acme</h1><p>Measure brand visibility across AI answers.</p></body></html>"
    )
    expect(tierOneCall[0].prompt).toContain(
      "Homepage markdown:\n# Acme\nMeasure brand visibility across AI answers."
    )
    expect(tierOneCall[0].prompt).not.toContain('"title"')
    expect(tierOneCall[0].prompt).not.toContain('"keywords"')

    expect(mockGetLanguageModel).toHaveBeenNthCalledWith(2, "openai", {
      capability: "webSearch",
    })
    expect(tierTwoCall[0].model).toEqual({
      capability: "webSearch",
      provider: "gateway",
    })
    expect(tierTwoCall[0].prompt).toContain("Tier 1 description")
    expect(tierTwoCall[0].prompt).toContain("Tier 1 topics")
    expect(tierTwoCall[0].tools).toBeUndefined()

    expect(result.description).toHaveLength(500)
    expect(result.topics).toEqual([
      "best ai visibility platforms",
      "how to improve brand citations in chatgpt",
    ])
    expect(result.competitors).toEqual([
      {
        name: "Competitor 1",
        website: "https://competitor-1.com",
      },
      {
        name: "Competitor 2",
        website: "https://competitor-2.com",
      },
      {
        name: "Competitor 3",
        website: "https://competitor-3.com",
      },
      {
        name: "Competitor 4",
        website: "https://competitor-4.com",
      },
      {
        name: "Competitor 5",
        website: "https://competitor-5.com",
      },
    ])
    expect(result.warnings).toEqual([
      "We found fewer than 3 strong topics. Review and add topics before continuing.",
    ])
  })
})
