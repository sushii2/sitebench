import { describe, expect, it } from "vitest"

import { resolveOnboardingConfig } from "@/lib/onboarding/config"

describe("resolveOnboardingConfig", () => {
  it("returns parsed config when env values are present", () => {
    expect(
      resolveOnboardingConfig({
        FIRECRAWL_API_KEY: "fc-key",
      })
    ).toEqual({
      FIRECRAWL_API_KEY: "fc-key",
    })
  })

  it("rejects a missing Firecrawl key", () => {
    expect(() =>
      resolveOnboardingConfig({
        FIRECRAWL_API_KEY: "",
      })
    ).toThrow("FIRECRAWL_API_KEY is required")
  })
})
