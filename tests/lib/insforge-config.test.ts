import { describe, expect, it } from "vitest"

import {
  resolveInsforgePublicConfig,
  resolveInsforgeServiceConfig,
} from "@/lib/insforge/config"

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

describe("resolveInsforgeServiceConfig", () => {
  it("returns parsed config when env values are present", () => {
    expect(
      resolveInsforgeServiceConfig({
        INSFORGE_API_KEY: "service-key",
        NEXT_PUBLIC_INSFORGE_ANON_KEY: "anon-key",
        NEXT_PUBLIC_INSFORGE_URL: "https://example.insforge.app",
      })
    ).toEqual({
      apiKey: "service-key",
      baseUrl: "https://example.insforge.app",
    })
  })

  it("rejects a missing service key", () => {
    expect(() =>
      resolveInsforgeServiceConfig({
        INSFORGE_API_KEY: "",
        NEXT_PUBLIC_INSFORGE_ANON_KEY: "anon-key",
        NEXT_PUBLIC_INSFORGE_URL: "https://example.insforge.app",
      })
    ).toThrow("INSFORGE_API_KEY is required")
  })
})
