import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGatewayModel = vi.fn((modelId: string) => ({
  modelId,
  provider: "gateway",
}))
const mockParallelSearch = vi.fn((config?: Record<string, unknown>) => ({
  config,
  type: "parallel_search",
}))
const mockPerplexitySearch = vi.fn((config?: Record<string, unknown>) => ({
  config,
  type: "perplexity_search",
}))
const mockAnthropicWebSearch = vi.fn((config?: Record<string, unknown>) => ({
  config,
  type: "anthropic_web_search",
}))

const mockCreateGateway = vi.fn(() =>
  Object.assign(mockGatewayModel, {
    tools: {
      parallelSearch: mockParallelSearch,
      perplexitySearch: mockPerplexitySearch,
    },
  })
)

vi.mock("ai", () => ({
  createGateway: mockCreateGateway,
}))

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: {
    tools: {
      webSearch_20250305: mockAnthropicWebSearch,
    },
  },
}))

vi.mock("@/lib/ai/config", () => ({
  getAiGatewayConfig: () => ({
    apiKey: "gateway-key",
  }),
}))

async function loadProviderConfigModule() {
  return import("@/lib/ai/provider-config")
}

describe("provider registry", () => {
  beforeEach(() => {
    vi.resetModules()
    mockCreateGateway.mockClear()
    mockGatewayModel.mockClear()
    mockParallelSearch.mockClear()
    mockPerplexitySearch.mockClear()
    mockAnthropicWebSearch.mockClear()
  })

  it("normalizes provider aliases", async () => {
    const { normalizeProviderId } = await loadProviderConfigModule()

    expect(normalizeProviderId("ChatGPT")).toBe("openai")
    expect(normalizeProviderId("claude")).toBe("anthropic")
    expect(normalizeProviderId("Sonar")).toBe("perplexity")
    expect(normalizeProviderId("unknown")).toBeNull()
  })

  it("returns enabled providers and honors overrides", async () => {
    const { getEnabledProviders } = await loadProviderConfigModule()

    expect(getEnabledProviders().map((provider) => provider.id)).toEqual([
      "anthropic",
      "openai",
      "perplexity",
    ])

    expect(
      getEnabledProviders({
        openai: false,
      }).map((provider) => provider.id)
    ).toEqual(["anthropic", "perplexity"])
  })

  it("filters providers by capability", async () => {
    const { getProvidersByCapability } = await loadProviderConfigModule()

    expect(
      getProvidersByCapability("structuredOutput").map((provider) => provider.id)
    ).toEqual(["anthropic", "openai"])
    expect(
      getProvidersByCapability("webSearch").map((provider) => provider.id)
    ).toEqual(["anthropic", "openai", "perplexity"])
    expect(getProvidersByCapability("reasoning")).toEqual([])
  })

  it("returns provider display metadata for UI", async () => {
    const { getProviderDisplayCatalog, getProviderDisplayInfo } =
      await loadProviderConfigModule()

    expect(getProviderDisplayInfo("openai")).toEqual({
      id: "openai",
      logo: "https://cdn.simpleicons.org/openai",
      models: [
        {
          id: "openai/gpt-5.4",
          name: "GPT-5.4",
        },
        {
          id: "openai/gpt-5.4-mini",
          name: "GPT-5.4 Mini",
        },
        {
          id: "openai/gpt-4o-mini-search-preview",
          name: "GPT-4o Mini Search Preview",
        },
      ],
      name: "ChatGPT",
    })

    expect(getProviderDisplayInfo("perplexity")).toEqual({
      id: "perplexity",
      logo: "https://cdn.simpleicons.org/perplexity",
      models: [
        {
          id: "perplexity/sonar",
          name: "Sonar",
        },
        {
          id: "perplexity/sonar-pro",
          name: "Sonar Pro",
        },
        {
          id: "perplexity/sonar-reasoning-pro",
          name: "Sonar Reasoning Pro",
        },
      ],
      name: "Perplexity",
    })

    expect(getProviderDisplayInfo("anthropic")).toEqual({
      id: "anthropic",
      logo: "https://cdn.simpleicons.org/anthropic",
      models: [
        {
          id: "anthropic/claude-sonnet-4.6",
          name: "Claude Sonnet 4.6",
        },
        {
          id: "anthropic/claude-haiku-4.5",
          name: "Claude Haiku 4.5",
        },
      ],
      name: "Anthropic",
    })

    expect(getProviderDisplayCatalog({ anthropic: false })).toEqual([
      getProviderDisplayInfo("openai"),
      getProviderDisplayInfo("perplexity"),
    ])
  })

  it("returns provider models and default models", async () => {
    const { getDefaultModel, getProviderModels } =
      await loadProviderConfigModule()

    expect(getProviderModels("openai")).toEqual([
      {
        capabilities: {
          reasoning: false,
          streamingResponse: true,
          structuredOutput: true,
          webSearch: true,
        },
        id: "openai/gpt-5.4",
        name: "GPT-5.4",
      },
      {
        capabilities: {
          reasoning: false,
          streamingResponse: true,
          structuredOutput: true,
          webSearch: true,
        },
        id: "openai/gpt-5.4-mini",
        name: "GPT-5.4 Mini",
      },
      {
        capabilities: {
          reasoning: false,
          streamingResponse: true,
          structuredOutput: true,
          webSearch: true,
        },
        id: "openai/gpt-4o-mini-search-preview",
        name: "GPT-4o Mini Search Preview",
      },
    ])

    expect(getDefaultModel("openai")?.id).toBe("openai/gpt-5.4")
    expect(getDefaultModel("openai", "webSearch")?.id).toBe("openai/gpt-5.4")
    expect(getDefaultModel("perplexity")?.id).toBe("perplexity/sonar")
    expect(getDefaultModel("perplexity", "webSearch")?.id).toBe(
      "perplexity/sonar"
    )
    expect(getDefaultModel("anthropic", "webSearch")?.id).toBe(
      "anthropic/claude-sonnet-4.6"
    )
    expect(
      getProviderModels("openai", {
        openai: false,
      })
    ).toEqual([])
  })

  it("builds gateway-backed language models and validates overrides", async () => {
    const { getLanguageModel, isProviderEnabled } =
      await loadProviderConfigModule()

    expect(isProviderEnabled("openai")).toBe(true)
    expect(
      getLanguageModel("openai", {
        capability: "structuredOutput",
      })
    ).toEqual({
      modelId: "openai/gpt-5.4",
      provider: "gateway",
    })
    expect(
      getLanguageModel("openai", {
        capability: "webSearch",
      })
    ).toEqual({
      modelId: "openai/gpt-5.4",
      provider: "gateway",
    })

    expect(mockCreateGateway).toHaveBeenCalledWith({
      apiKey: "gateway-key",
    })
    expect(mockGatewayModel).toHaveBeenCalledWith("openai/gpt-5.4")

    expect(() =>
      getLanguageModel("openai", {
        capability: "webSearch",
        overrides: { openai: false },
      })
    ).toThrow('Provider "openai" is disabled')
  })

  it("builds a Parallel search tool with the configured defaults", async () => {
    const { getParallelWebSearchTool } = await loadProviderConfigModule()

    expect(
      getParallelWebSearchTool({
        excerpts: {
          maxCharsPerResult: 1200,
        },
        maxResults: 6,
        mode: "agentic",
      })
    ).toEqual({
      config: {
        excerpts: {
          maxCharsPerResult: 1200,
        },
        maxResults: 6,
        mode: "agentic",
      },
      type: "parallel_search",
    })
    expect(mockParallelSearch).toHaveBeenCalledWith({
      excerpts: {
        maxCharsPerResult: 1200,
      },
      maxResults: 6,
      mode: "agentic",
    })
  })

  it("builds a Perplexity search tool with the default filters", async () => {
    const { getPerplexityWebSearchTool } = await loadProviderConfigModule()

    expect(getPerplexityWebSearchTool()).toEqual({
      config: undefined,
      type: "perplexity_search",
    })
    expect(mockPerplexitySearch).toHaveBeenCalledWith()
  })

  it("builds an Anthropic native web search tool", async () => {
    const { getAnthropicWebSearchTool } = await loadProviderConfigModule()

    expect(
      getAnthropicWebSearchTool({
        maxUses: 5,
        userLocation: {
          type: "approximate",
          country: "US",
        },
      })
    ).toEqual({
      config: {
        maxUses: 5,
        userLocation: {
          type: "approximate",
          country: "US",
        },
      },
      type: "anthropic_web_search",
    })
    expect(mockAnthropicWebSearch).toHaveBeenCalledWith({
      maxUses: 5,
      userLocation: {
        type: "approximate",
        country: "US",
      },
    })
  })
})
