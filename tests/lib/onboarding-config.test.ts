import { describe, expect, it } from "vitest"

import { resolveOnboardingConfig } from "@/lib/onboarding/config"

describe("resolveOnboardingConfig", () => {
  it("returns parsed config when env values are present", () => {
    expect(
      resolveOnboardingConfig({
        AI_GATEWAY_API_KEY: "gateway-key",
        FIRECRAWL_API_KEY: "fc-key",
      })
    ).toEqual({
      AI_GATEWAY_API_KEY: "gateway-key",
      FIRECRAWL_API_KEY: "fc-key",
    })
  })

  it("rejects a missing AI gateway key", () => {
    expect(() =>
      resolveOnboardingConfig({
        AI_GATEWAY_API_KEY: "",
        FIRECRAWL_API_KEY: "fc-key",
      })
    ).toThrow("AI_GATEWAY_API_KEY is required")
  })

  it("rejects a missing Firecrawl key", () => {
    expect(() =>
      resolveOnboardingConfig({
        AI_GATEWAY_API_KEY: "gateway-key",
        FIRECRAWL_API_KEY: "",
      })
    ).toThrow("FIRECRAWL_API_KEY is required")
  })
})

