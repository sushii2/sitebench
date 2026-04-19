import { describe, expect, it } from "vitest"

import {
  mockSentiment,
  mockStatusRanAt,
  mockTopPerformerCount,
  mockVisibility,
} from "@/lib/dashboard/prompts-mock"

describe("prompts mock generator", () => {
  it("returns the same visibility for the same prompt and platform", () => {
    const a = mockVisibility("prompt-1", "chatgpt")
    const b = mockVisibility("prompt-1", "chatgpt")

    expect(a).toBe(b)
  })

  it("varies visibility when the platform changes", () => {
    const chatgpt = mockVisibility("prompt-1", "chatgpt")
    const claude = mockVisibility("prompt-1", "claude")

    expect(chatgpt).not.toBe(claude)
  })

  it("clamps visibility to 0..100", () => {
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      const value = mockVisibility(id, "chatgpt")

      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })

  it("returns one of the three sentiment tones", () => {
    const tone = mockSentiment("prompt-1", "chatgpt")

    expect(["positive", "neutral", "negative"]).toContain(tone)
  })

  it("returns the same sentiment for the same input", () => {
    expect(mockSentiment("prompt-1", "claude")).toBe(
      mockSentiment("prompt-1", "claude")
    )
  })

  it("returns a Date in the past for status", () => {
    const ranAt = mockStatusRanAt("prompt-1")

    expect(ranAt.getTime()).toBeLessThanOrEqual(Date.now())
  })

  it("returns a positive integer top performer count", () => {
    const count = mockTopPerformerCount("prompt-1")

    expect(Number.isInteger(count)).toBe(true)
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
