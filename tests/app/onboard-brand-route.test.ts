import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthenticateOnboardingRequest = vi.fn()
const mockGenerateCompatibilityOnboardingSuggestions = vi.fn()

vi.mock("@/lib/onboarding", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/onboarding")>("@/lib/onboarding")

  return {
    ...actual,
    authenticateOnboardingRequest: mockAuthenticateOnboardingRequest,
    generateCompatibilityOnboardingSuggestions:
      mockGenerateCompatibilityOnboardingSuggestions,
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
    mockGenerateCompatibilityOnboardingSuggestions.mockReset()

    mockAuthenticateOnboardingRequest.mockResolvedValue({
      id: "user-1",
    })
    mockGenerateCompatibilityOnboardingSuggestions.mockResolvedValue({
      competitors: [{ name: "Competitor 1", website: "https://competitor-1.com" }],
      description: "Suggested description",
      topics: ["ai search", "perplexity", "brand search"],
      warnings: [],
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

  it("returns compatibility suggestions on success", async () => {
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
    expect(mockGenerateCompatibilityOnboardingSuggestions).toHaveBeenCalledWith({
      companyName: "Acme",
      website: "https://acme.com",
    })
  })

  it("returns best-effort empty suggestions when the shared helper does", async () => {
    mockGenerateCompatibilityOnboardingSuggestions.mockResolvedValue({
      competitors: [],
      description: "",
      topics: [],
      warnings: ["Homepage scrape unavailable"],
    })

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
  })

  it("returns 502 when the shared helper fails unexpectedly", async () => {
    mockGenerateCompatibilityOnboardingSuggestions.mockRejectedValue(
      new Error("Unexpected provider failure")
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

    expect(response.status).toBe(502)
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "Unexpected provider failure",
      },
    })
    expect(errorSpy).toHaveBeenCalledWith(
      "[onboarding] Compatibility route failed",
      expect.any(Error)
    )

    errorSpy.mockRestore()
  })
})
