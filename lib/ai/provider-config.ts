import "server-only"

import { createGateway } from "ai"

import { getAiGatewayConfig } from "@/lib/ai/config"

export type ProviderId = "openai" | "anthropic" | "perplexity"
export type ProviderCapability =
  | "reasoning"
  | "webSearch"
  | "structuredOutput"
  | "streamingResponse"

export interface ProviderModelConfig {
  capabilities: Record<ProviderCapability, boolean>
  id: string
  name: string
}

export interface ProviderDisplayInfo {
  id: ProviderId
  logo: string
  models: Array<Pick<ProviderModelConfig, "id" | "name">>
  name: string
}

export type ProviderOverrideMap = Partial<Record<ProviderId, boolean>>

export interface ProviderConfig {
  capabilities: Record<ProviderCapability, boolean>
  defaultModelId: string
  id: ProviderId
  logo: string
  models: ProviderModelConfig[]
  name: string
}

export interface GetLanguageModelOptions {
  capability?: ProviderCapability
  modelId?: string
  overrides?: ProviderOverrideMap
}

type GatewayProviderInstance = ReturnType<typeof createGateway>
type GatewayLanguageModel = ReturnType<GatewayProviderInstance>

type ProviderRegistryEntry = ProviderConfig & {
  capabilityDefaultModelIds: Partial<Record<ProviderCapability, string>>
  models: ProviderModelConfig[]
}

const PROVIDER_ALIASES = new Map<string, ProviderId>([
  ["anthropic", "anthropic"],
  ["chatgpt", "openai"],
  ["claude", "anthropic"],
  ["openai", "openai"],
  ["perplexity", "perplexity"],
  ["sonar", "perplexity"],
])

const DEFAULT_PROVIDER_ENABLEMENT: Record<ProviderId, boolean> = {
  anthropic: true,
  openai: true,
  perplexity: true,
}

const PROVIDER_REGISTRY: Record<ProviderId, ProviderRegistryEntry> = {
  anthropic: {
    capabilities: createCapabilityMap({
      streamingResponse: true,
      structuredOutput: true,
    }),
    capabilityDefaultModelIds: {
      streamingResponse: "anthropic/claude-haiku-4.5",
      structuredOutput: "anthropic/claude-haiku-4.5",
    },
    defaultModelId: "anthropic/claude-haiku-4.5",
    id: "anthropic",
    logo: "https://cdn.simpleicons.org/anthropic",
    models: [
      {
        capabilities: createCapabilityMap({
          streamingResponse: true,
          structuredOutput: true,
        }),
        id: "anthropic/claude-haiku-4.5",
        name: "Claude Haiku 4.5",
      },
    ],
    name: "Anthropic",
  },
  openai: {
    capabilities: createCapabilityMap({
      streamingResponse: true,
      structuredOutput: true,
      webSearch: true,
    }),
    capabilityDefaultModelIds: {
      streamingResponse: "openai/gpt-5.4-mini",
      structuredOutput: "openai/gpt-5.4-mini",
      webSearch: "openai/gpt-4o-mini-search-preview",
    },
    defaultModelId: "openai/gpt-5.4-mini",
    id: "openai",
    logo: "https://cdn.simpleicons.org/openai",
    models: [
      {
        capabilities: createCapabilityMap({
          streamingResponse: true,
          structuredOutput: true,
        }),
        id: "openai/gpt-5.4-mini",
        name: "GPT-5.4 Mini",
      },
      {
        capabilities: createCapabilityMap({
          streamingResponse: true,
          structuredOutput: true,
          webSearch: true,
        }),
        id: "openai/gpt-4o-mini-search-preview",
        name: "GPT-4o Mini Search Preview",
      },
    ],
    name: "ChatGPT",
  },
  perplexity: {
    capabilities: createCapabilityMap({
      streamingResponse: true,
      webSearch: true,
    }),
    capabilityDefaultModelIds: {
      streamingResponse: "perplexity/sonar",
      webSearch: "perplexity/sonar",
    },
    defaultModelId: "perplexity/sonar",
    id: "perplexity",
    logo: "https://cdn.simpleicons.org/perplexity",
    models: [
      {
        capabilities: createCapabilityMap({
          streamingResponse: true,
          webSearch: true,
        }),
        id: "perplexity/sonar",
        name: "Sonar",
      },
    ],
    name: "Perplexity",
  },
}

let cachedGatewayProvider: GatewayProviderInstance | null = null

function createCapabilityMap(
  enabledCapabilities: Partial<Record<ProviderCapability, boolean>>
): Record<ProviderCapability, boolean> {
  return {
    reasoning: enabledCapabilities.reasoning ?? false,
    streamingResponse: enabledCapabilities.streamingResponse ?? false,
    structuredOutput: enabledCapabilities.structuredOutput ?? false,
    webSearch: enabledCapabilities.webSearch ?? false,
  }
}

function getGatewayProvider() {
  if (!cachedGatewayProvider) {
    cachedGatewayProvider = createGateway({
      apiKey: getAiGatewayConfig().apiKey,
    })
  }

  return cachedGatewayProvider
}

function getProviderEntry(providerId: ProviderId) {
  return PROVIDER_REGISTRY[providerId]
}

function normalizeProviderAlias(input: string) {
  return input.trim().toLowerCase().replace(/[\s._/-]+/g, "")
}

function resolveProviderEnabled(
  providerId: ProviderId,
  overrides?: ProviderOverrideMap
) {
  const override = overrides?.[providerId]

  if (typeof override === "boolean") {
    return override
  }

  return DEFAULT_PROVIDER_ENABLEMENT[providerId]
}

function toProviderConfig(entry: ProviderRegistryEntry): ProviderConfig {
  return {
    capabilities: { ...entry.capabilities },
    defaultModelId: entry.defaultModelId,
    id: entry.id,
    logo: entry.logo,
    models: entry.models.map((model) => ({
      capabilities: { ...model.capabilities },
      id: model.id,
      name: model.name,
    })),
    name: entry.name,
  }
}

export function normalizeProviderId(input: string): ProviderId | null {
  return PROVIDER_ALIASES.get(normalizeProviderAlias(input)) ?? null
}

export function getEnabledProviders(overrides?: ProviderOverrideMap) {
  return (Object.keys(PROVIDER_REGISTRY) as ProviderId[])
    .filter((providerId) => resolveProviderEnabled(providerId, overrides))
    .map((providerId) => toProviderConfig(getProviderEntry(providerId)))
}

export function getProvidersByCapability(
  capability: ProviderCapability,
  overrides?: ProviderOverrideMap
) {
  return getEnabledProviders(overrides).filter(
    (provider) => provider.capabilities[capability]
  )
}

export function isProviderEnabled(
  providerId: ProviderId,
  overrides?: ProviderOverrideMap
) {
  return resolveProviderEnabled(providerId, overrides)
}

export function getProviderDisplayInfo(providerId: ProviderId) {
  const { id, logo, models, name } = getProviderEntry(providerId)

  return {
    id,
    logo,
    models: models.map(({ id: modelId, name: modelName }) => ({
      id: modelId,
      name: modelName,
    })),
    name,
  } satisfies ProviderDisplayInfo
}

export function getProviderDisplayCatalog(overrides?: ProviderOverrideMap) {
  return getEnabledProviders(overrides).map((provider) =>
    getProviderDisplayInfo(provider.id)
  )
}

export function getProviderModels(
  providerId: ProviderId,
  overrides?: ProviderOverrideMap
) {
  if (!resolveProviderEnabled(providerId, overrides)) {
    return []
  }

  return getProviderEntry(providerId).models.map((model) => ({
    capabilities: { ...model.capabilities },
    id: model.id,
    name: model.name,
  }))
}

export function getDefaultModel(
  providerId: ProviderId,
  capability?: ProviderCapability,
  overrides?: ProviderOverrideMap
) {
  if (!resolveProviderEnabled(providerId, overrides)) {
    return null
  }

  const entry = getProviderEntry(providerId)
  const modelId =
    (capability ? entry.capabilityDefaultModelIds[capability] : null) ??
    entry.defaultModelId

  if (capability && !entry.capabilities[capability]) {
    return null
  }

  return (
    entry.models.find((model) => model.id === modelId) ??
    entry.models.find((model) => !capability || model.capabilities[capability]) ??
    null
  )
}

export function getLanguageModel(
  providerId: ProviderId,
  options?: GetLanguageModelOptions
): GatewayLanguageModel {
  if (!resolveProviderEnabled(providerId, options?.overrides)) {
    throw new Error(`Provider "${providerId}" is disabled`)
  }

  const entry = getProviderEntry(providerId)
  const selectedModel =
    (options?.modelId
      ? entry.models.find((model) => model.id === options.modelId)
      : undefined) ??
    getDefaultModel(providerId, options?.capability, options?.overrides)

  if (!selectedModel) {
    const capabilityLabel = options?.capability
      ? ` for capability "${options.capability}"`
      : ""

    throw new Error(
      `No model is configured for provider "${providerId}"${capabilityLabel}`
    )
  }

  if (
    options?.capability &&
    !selectedModel.capabilities[options.capability]
  ) {
    throw new Error(
      `Model "${selectedModel.id}" does not support capability "${options.capability}"`
    )
  }

  return getGatewayProvider()(selectedModel.id)
}
