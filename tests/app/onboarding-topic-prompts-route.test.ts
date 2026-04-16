import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthenticateOnboardingRequest = vi.fn()
const mockGenerateTopicPromptCollection = vi.fn()

vi.mock("@/lib/onboarding", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/onboarding")>("@/lib/onboarding")

  return {
    ...actual,
    authenticateOnboardingRequest: mockAuthenticateOnboardingRequest,
    generateTopicPromptCollection: mockGenerateTopicPromptCollection,
  }
})

async function loadRoute() {
  const route = await import("@/app/api/onboarding/topic-prompts/route")

  return route.POST
}

describe("POST /api/onboarding/topic-prompts", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthenticateOnboardingRequest.mockReset()
    mockGenerateTopicPromptCollection.mockReset()

    mockAuthenticateOnboardingRequest.mockResolvedValue({
      id: "user-1",
    })
    mockGenerateTopicPromptCollection.mockReturnValue({
      topics: [
        {
          prompts: [
            { addedVia: "ai_suggested", promptText: "Best AI search tools" },
            {
              addedVia: "ai_suggested",
              promptText: "How does Acme compare to OpenAI for AI search?",
            },
          ],
          source: "ai_suggested",
          topicName: "ai search",
        },
      ],
      warnings: [],
    })
  })

  it("returns 401 without a valid bearer token", async () => {
    mockAuthenticateOnboardingRequest.mockResolvedValue(null)

    const POST = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/onboarding/topic-prompts", {
        body: JSON.stringify({
          companyName: "Acme",
          competitors: [],
          description: "Description",
          topics: [{ source: "ai_suggested", topicName: "ai search" }],
          website: "https://acme.com",
        }),
        method: "POST",
      })
    )

    expect(response.status).toBe(401)
  })

  it("returns prompt drafts for valid topics", async () => {
    const POST = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/onboarding/topic-prompts", {
        body: JSON.stringify({
          companyName: "Acme",
          competitors: [
            { name: "OpenAI", website: "https://openai.com" },
            { name: "Anthropic", website: "https://anthropic.com" },
          ],
          description: "Description",
          topics: [{ source: "ai_suggested", topicName: "ai search" }],
          website: "https://acme.com",
        }),
        headers: {
          Authorization: "Bearer token-123",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      topics: [
        {
          prompts: [
            { addedVia: "ai_suggested", promptText: "Best AI search tools" },
            {
              addedVia: "ai_suggested",
              promptText: "How does Acme compare to OpenAI for AI search?",
            },
          ],
          source: "ai_suggested",
          topicName: "ai search",
        },
      ],
      warnings: [],
    })
  })
})
