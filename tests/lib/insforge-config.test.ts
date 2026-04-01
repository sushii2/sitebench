import { describe, expect, it } from "vitest"

import { resolveInsforgePublicConfig } from "@/lib/insforge/config"

describe("resolveInsforgePublicConfig", () => {
  it("returns parsed config when env values are present", () => {
    expect(
      resolveInsforgePublicConfig({
        NEXT_PUBLIC_INSFORGE_ANON_KEY: "anon-key",
        NEXT_PUBLIC_INSFORGE_URL: "https://example.insforge.app",
      })
    ).toEqual({
      anonKey: "anon-key",
      baseUrl: "https://example.insforge.app",
    })
  })

  it("rejects a missing anon key", () => {
    expect(() =>
      resolveInsforgePublicConfig({
        NEXT_PUBLIC_INSFORGE_ANON_KEY: "",
        NEXT_PUBLIC_INSFORGE_URL: "https://example.insforge.app",
      })
    ).toThrow("NEXT_PUBLIC_INSFORGE_ANON_KEY is required")
  })

  it("rejects an invalid url", () => {
    expect(() =>
      resolveInsforgePublicConfig({
        NEXT_PUBLIC_INSFORGE_ANON_KEY: "anon-key",
        NEXT_PUBLIC_INSFORGE_URL: "not-a-url",
      })
    ).toThrow("NEXT_PUBLIC_INSFORGE_URL must be a valid URL")
  })
})
