import { describe, expect, it } from "vitest"

import { generateTopicPromptDrafts } from "@/lib/onboarding/topic-prompt-generator"

describe("generateTopicPromptDrafts", () => {
  it("returns exactly two prompts per topic", () => {
    const result = generateTopicPromptDrafts({
      companyName: "Acme",
      competitors: [
        { name: "OpenAI", website: "https://openai.com" },
        { name: "Anthropic", website: "https://anthropic.com" },
      ],
      description:
        "Acme helps B2B marketing teams measure brand visibility across AI answers.",
      topicName: "ai visibility",
      topicSource: "ai_suggested",
      website: "https://acme.com",
    })

    expect(result.topicName).toBe("ai visibility")
    expect(result.prompts).toHaveLength(2)
    expect(result.prompts.map((prompt) => prompt.addedVia)).toEqual([
      "ai_suggested",
      "ai_suggested",
    ])
  })

  it("keeps competitors out of the discovery prompt", () => {
    const result = generateTopicPromptDrafts({
      companyName: "Acme",
      competitors: [
        { name: "OpenAI", website: "https://openai.com" },
        { name: "Anthropic", website: "https://anthropic.com" },
      ],
      description:
        "Acme helps B2B marketing teams measure brand visibility across ChatGPT, Gemini, and Perplexity.",
      topicName: "ai search",
      topicSource: "ai_suggested",
      website: "https://acme.com",
    })

    expect(result.prompts[0]?.promptText).toContain("brand visibility")
    expect(result.prompts[0]?.promptText).toContain("ChatGPT")
    expect(result.prompts[0]?.promptText).toContain("Gemini")
    expect(result.prompts[0]?.promptText).toContain("Perplexity")
    expect(result.prompts[0]?.promptText).not.toContain("Acme")
    expect(result.prompts[0]?.promptText).not.toContain("OpenAI")
    expect(result.prompts[0]?.promptText).not.toContain("Anthropic")
  })

  it("includes the company and first two competitors in the comparison prompt", () => {
    const result = generateTopicPromptDrafts({
      companyName: "Acme",
      competitors: [
        { name: "OpenAI", website: "https://openai.com" },
        { name: "Anthropic", website: "https://anthropic.com" },
        { name: "Perplexity", website: "https://perplexity.ai" },
      ],
      description: "Acme helps teams monitor AI search visibility.",
      topicName: "brand citations",
      topicSource: "user_added",
      website: "https://acme.com",
    })

    expect(result.prompts[1]?.promptText).toContain("Acme")
    expect(result.prompts[1]?.promptText).toContain("OpenAI")
    expect(result.prompts[1]?.promptText).toContain("Anthropic")
    expect(result.prompts[1]?.promptText).not.toContain("Perplexity")
    expect(result.prompts[1]?.promptText).toContain("citation tracking")
  })

  it("builds topic-specific prompts for prompt monitoring topics", () => {
    const result = generateTopicPromptDrafts({
      companyName: "Acme",
      competitors: [
        { name: "Profound", website: "https://profound.com" },
        { name: "Scrunch AI", website: "https://scrunch.ai" },
      ],
      description:
        "Acme helps brand and SEO teams monitor how often their company appears in AI-generated answers.",
      topicName: "prompt monitoring",
      topicSource: "user_added",
      website: "https://acme.com",
    })

    expect(result.prompts[0]?.promptText).toContain("prompt coverage")
    expect(result.prompts[0]?.promptText).toContain("AI answers")
    expect(result.prompts[1]?.promptText).toContain("alerting")
    expect(result.prompts[1]?.promptText).toContain("Profound")
    expect(result.prompts[1]?.promptText).toContain("Scrunch AI")
  })

  it("builds topic-specific prompts for competitor analysis topics", () => {
    const result = generateTopicPromptDrafts({
      companyName: "Acme",
      competitors: [
        { name: "Profound", website: "https://profound.com" },
        { name: "Scrunch AI", website: "https://scrunch.ai" },
      ],
      description:
        "Acme gives marketing leaders reporting on how their brand compares with competitors in large language models.",
      topicName: "competitor analysis",
      topicSource: "ai_suggested",
      website: "https://acme.com",
    })

    expect(result.prompts[0]?.promptText).toContain("share of voice")
    expect(result.prompts[1]?.promptText).toContain("competitive benchmarking")
    expect(result.prompts[1]?.promptText).toContain("Acme")
    expect(result.prompts[1]?.promptText).toContain("Profound")
    expect(result.prompts[1]?.promptText).toContain("Scrunch AI")
  })
})
