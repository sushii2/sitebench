import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthenticateOnboardingRequest = vi.fn()
const mockScrapeBrandHomepage = vi.fn()
const mockNormalizeBrandOnboarding = vi.fn()
const mockBuildFallbackOnboardingSuggestions = vi.fn()

vi.mock("@/lib/onboarding", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/onboarding")>("@/lib/onboarding")

  return {
    ...actual,
    authenticateOnboardingRequest: mockAuthenticateOnboardingRequest,
    buildFallbackOnboardingSuggestions: mockBuildFallbackOnboardingSuggestions,
    normalizeBrandOnboarding: mockNormalizeBrandOnboarding,
    scrapeBrandHomepage: mockScrapeBrandHomepage,
  }
})

async function loadRoute() {
  const route = await import("@/app/api/onboard-brand/route")

  return route.POST
}

describe("POST /api/onboard-brand", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthenticateOnboardingRequest.mockReset()
    mockScrapeBrandHomepage.mockReset()
    mockNormalizeBrandOnboarding.mockReset()
    mockBuildFallbackOnboardingSuggestions.mockReset()

    mockAuthenticateOnboardingRequest.mockResolvedValue({
      id: "user-1",
    })
    mockScrapeBrandHomepage.mockResolvedValue({
      branding: null,
      description: "Description",
      keywords: ["ai search"],
      links: ["https://acme.com/pricing"],
      markdown: "# Acme",
      requestedUrl: "https://acme.com",
      resolvedUrl: "https://acme.com",
      title: "Acme",
    })
    mockNormalizeBrandOnboarding.mockResolvedValue({
      competitors: [{ name: "Competitor 1", website: "https://competitor-1.com" }],
      description: "Suggested description",
      topics: ["ai search", "perplexity", "brand search"],
      warnings: [],
    })
    mockBuildFallbackOnboardingSuggestions.mockReturnValue({
      competitors: [],
      description: "Fallback description",
      topics: ["ai search"],
      warnings: [
        "We found fewer than 3 strong topics. Review and add topics before continuing.",
      ],
    })
  })

  it("returns 401 without a valid bearer token", async () => {
    mockAuthenticateOnboardingRequest.mockResolvedValue(null)

    const POST = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/onboard-brand", {
        body: JSON.stringify({
          companyName: "Acme",
          website: "https://acme.com",
        }),
        method: "POST",
      })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "You must be signed in to continue.",
      },
    })
  })

  it("returns 400 for an invalid request body", async () => {
    const POST = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/onboard-brand", {
        body: JSON.stringify({
          companyName: "",
          website: "",
        }),
        method: "POST",
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "Company name is required",
      },
    })
  })

  it("returns normalized onboarding suggestions on success", async () => {
    const POST = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/onboard-brand", {
        body: JSON.stringify({
          companyName: "Acme",
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
      competitors: [
        { name: "Competitor 1", website: "https://competitor-1.com" },
      ],
      description: "Suggested description",
      topics: ["ai search", "perplexity", "brand search"],
      warnings: [],
    })
    expect(mockAuthenticateOnboardingRequest).toHaveBeenCalledWith(
      "Bearer token-123"
    )
    expect(mockNormalizeBrandOnboarding).toHaveBeenCalled()
  })

  it("logs normalization failures before returning fallback suggestions", async () => {
    mockNormalizeBrandOnboarding.mockRejectedValue(
      new Error("Normalization timed out")
    )
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})

    const POST = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/onboard-brand", {
        body: JSON.stringify({
          companyName: "Acme",
          website: "https://acme.com",
        }),
        headers: {
          Authorization: "Bearer token-123",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(200)
    expect(errorSpy).toHaveBeenCalledWith(
      "[onboarding] Normalization failed",
      expect.any(Error)
    )

    errorSpy.mockRestore()
  })

  it("returns a best-effort empty response when scraping fails", async () => {
    mockScrapeBrandHomepage.mockRejectedValue(
      new Error("Homepage scrape unavailable")
    )

    const POST = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/onboard-brand", {
        body: JSON.stringify({
          companyName: "Acme",
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
      competitors: [],
      description: "",
      topics: [],
      warnings: ["Homepage scrape unavailable"],
    })
    expect(mockNormalizeBrandOnboarding).not.toHaveBeenCalled()
  })

  it("returns fallback suggestions with warnings when AI normalization fails", async () => {
    mockNormalizeBrandOnboarding.mockRejectedValue(
      new Error("Normalization timed out")
    )

    const POST = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/onboard-brand", {
        body: JSON.stringify({
          companyName: "Acme",
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
      competitors: [],
      description: "Fallback description",
      topics: ["ai search"],
      warnings: [
        "Normalization timed out",
        "We found fewer than 3 strong topics. Review and add topics before continuing.",
      ],
    })
  })
})
