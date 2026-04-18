import { beforeEach, describe, expect, it, vi } from "vitest"

const mockGatewayModel = vi.fn((modelId: string) => ({
  modelId,
  provider: "gateway",
}))

const mockCreateGateway = vi.fn(() => mockGatewayModel)

vi.mock("ai", () => ({
  createGateway: mockCreateGateway,
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
    ).toEqual(["openai", "perplexity"])
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

    expect(getDefaultModel("openai")?.id).toBe("openai/gpt-5.4-mini")
    expect(getDefaultModel("openai", "webSearch")?.id).toBe("openai/gpt-5.4-mini")
    expect(getDefaultModel("anthropic", "webSearch")).toBeNull()
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
      modelId: "openai/gpt-5.4-mini",
      provider: "gateway",
    })
    expect(
      getLanguageModel("openai", {
        capability: "webSearch",
      })
    ).toEqual({
      modelId: "openai/gpt-5.4-mini",
      provider: "gateway",
    })

    expect(mockCreateGateway).toHaveBeenCalledWith({
      apiKey: "gateway-key",
    })
    expect(mockGatewayModel).toHaveBeenCalledWith("openai/gpt-5.4-mini")

    expect(() =>
      getLanguageModel("openai", {
        capability: "webSearch",
        overrides: { openai: false },
      })
    ).toThrow('Provider "openai" is disabled')
  })
})
