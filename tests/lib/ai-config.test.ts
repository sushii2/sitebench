import { beforeEach, describe, expect, it, vi } from "vitest"

async function loadAiConfigModule() {
  return import("@/lib/ai/config")
}

describe("resolveAiGatewayConfig", () => {
  beforeEach(() => {
    vi.resetModules()
    delete process.env.AI_GATEWAY_API_KEY
  })

  it("returns parsed config when the gateway key is present", async () => {
    const { resolveAiGatewayConfig } = await loadAiConfigModule()

    expect(
      resolveAiGatewayConfig({
        AI_GATEWAY_API_KEY: "gateway-key",
      })
    ).toEqual({
      apiKey: "gateway-key",
    })
  })

  it("rejects a missing gateway key", async () => {
    const { resolveAiGatewayConfig } = await loadAiConfigModule()

    expect(() =>
      resolveAiGatewayConfig({
        AI_GATEWAY_API_KEY: "",
      })
    ).toThrow("AI_GATEWAY_API_KEY is required")
  })

  it("caches the resolved gateway config", async () => {
    process.env.AI_GATEWAY_API_KEY = "first-key"

    const { getAiGatewayConfig } = await loadAiConfigModule()
    const first = getAiGatewayConfig()

    process.env.AI_GATEWAY_API_KEY = "second-key"

    expect(getAiGatewayConfig()).toBe(first)
    expect(getAiGatewayConfig()).toEqual({
      apiKey: "first-key",
    })
  })
})
