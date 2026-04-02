import { describe, expect, it } from "vitest"

import { resolveLogoDevPublicConfig } from "@/lib/logo-dev/config"

describe("resolveLogoDevPublicConfig", () => {
  it("returns parsed config when the publishable key is present", () => {
    expect(
      resolveLogoDevPublicConfig({
        NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY: "pk_test_123",
      })
    ).toEqual({
      publishableKey: "pk_test_123",
    })
  })

  it("rejects a missing publishable key", () => {
    expect(() =>
      resolveLogoDevPublicConfig({
        NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY: "",
      })
    ).toThrow("NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY is required")
  })
})
