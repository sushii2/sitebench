import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthenticateOnboardingRequest = vi.fn()
const mockCreateAuthenticatedOnboardingClient = vi.fn()
const mockCompleteOnboardingSetup = vi.fn()

vi.mock("@/lib/onboarding", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/onboarding")>("@/lib/onboarding")

  return {
    ...actual,
    authenticateOnboardingRequest: mockAuthenticateOnboardingRequest,
    completeOnboardingSetup: mockCompleteOnboardingSetup,
    createAuthenticatedOnboardingClient: mockCreateAuthenticatedOnboardingClient,
  }
})

async function loadRoute() {
  const route = await import("@/app/api/onboarding/complete/route")

  return route.POST
}

describe("POST /api/onboarding/complete", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthenticateOnboardingRequest.mockReset()
    mockCreateAuthenticatedOnboardingClient.mockReset()
    mockCompleteOnboardingSetup.mockReset()

    mockAuthenticateOnboardingRequest.mockResolvedValue({
      id: "user-1",
    })
    mockCreateAuthenticatedOnboardingClient.mockReturnValue({
      auth: {},
      database: {},
    })
    mockCompleteOnboardingSetup.mockResolvedValue({
      company_name: "Acme",
      competitors: [],
      created_at: "2026-01-01T00:00:00.000Z",
      description: "Description",
      id: "project-1",
      onboarding_completed_at: "2026-01-02T00:00:00.000Z",
      topics: ["ai search"],
      updated_at: "2026-01-02T00:00:00.000Z",
      user_id: "user-1",
      website: "https://acme.com",
    })
  })

  it("returns 401 without auth", async () => {
    mockAuthenticateOnboardingRequest.mockResolvedValue(null)

    const POST = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/onboarding/complete", {
        body: JSON.stringify({
          competitors: [
            { name: "OpenAI", website: "https://openai.com" },
            { name: "Anthropic", website: "https://anthropic.com" },
            { name: "Perplexity", website: "https://perplexity.ai" },
          ],
          companyName: "Acme",
          description: "Description",
          projectId: "project-1",
          topics: [
            {
              prompts: [
                {
                  addedVia: "ai_suggested",
                  promptText: "Best AI search tools",
                },
                {
                  addedVia: "ai_suggested",
                  promptText: "How does Acme compare to OpenAI for AI search?",
                },
              ],
              source: "ai_suggested",
              topicName: "ai search",
            },
            {
              prompts: [
                {
                  addedVia: "ai_suggested",
                  promptText: "Best brand citations tools",
                },
                {
                  addedVia: "ai_suggested",
                  promptText:
                    "How does Acme compare to Anthropic for brand citations?",
                },
              ],
              source: "ai_suggested",
              topicName: "brand citations",
            },
            {
              prompts: [
                {
                  addedVia: "ai_suggested",
                  promptText: "Best answer engine optimization tools",
                },
                {
                  addedVia: "ai_suggested",
                  promptText:
                    "How does Acme compare to Perplexity for answer engines?",
                },
              ],
              source: "ai_suggested",
              topicName: "answer engines",
            },
          ],
          website: "https://acme.com",
        }),
        method: "POST",
      })
    )

    expect(response.status).toBe(401)
  })

  it("persists onboarding data and completes setup", async () => {
    const POST = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/onboarding/complete", {
        body: JSON.stringify({
          competitors: [
            { name: "OpenAI", website: "https://openai.com" },
            { name: "Anthropic", website: "https://anthropic.com" },
            { name: "Perplexity", website: "https://perplexity.ai" },
          ],
          companyName: "Acme",
          description: "Description",
          projectId: "project-1",
          topics: [
            {
              prompts: [
                {
                  addedVia: "ai_suggested",
                  promptText: "Best AI search tools",
                },
                {
                  addedVia: "ai_suggested",
                  promptText: "How does Acme compare to OpenAI for AI search?",
                },
              ],
              source: "ai_suggested",
              topicName: "ai search",
            },
            {
              prompts: [
                {
                  addedVia: "ai_suggested",
                  promptText: "Best brand citations tools",
                },
                {
                  addedVia: "ai_suggested",
                  promptText:
                    "How does Acme compare to Anthropic for brand citations?",
                },
              ],
              source: "ai_suggested",
              topicName: "brand citations",
            },
            {
              prompts: [
                {
                  addedVia: "ai_suggested",
                  promptText: "Best answer engine optimization tools",
                },
                {
                  addedVia: "ai_suggested",
                  promptText:
                    "How does Acme compare to Perplexity for answer engines?",
                },
              ],
              source: "ai_suggested",
              topicName: "answer engines",
            },
          ],
          website: "https://acme.com",
        }),
        headers: {
          Authorization: "Bearer token-123",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    expect(mockCreateAuthenticatedOnboardingClient).toHaveBeenCalledWith(
      "Bearer token-123"
    )
    expect(mockCompleteOnboardingSetup).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: {},
        database: {},
      }),
      expect.objectContaining({
        companyName: "Acme",
        projectId: "project-1",
      })
    )
  })
})
