import { beforeEach, describe, expect, it, vi } from "vitest"

const mockAuthenticateOnboardingRequest = vi.fn()
const mockAssertOnboardingAnalysisTablesAvailable = vi.fn()
const mockCreateAuthenticatedOnboardingClient = vi.fn()
const mockStartOnboardingAnalysisRun = vi.fn()

vi.mock("@/lib/onboarding", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/onboarding")>("@/lib/onboarding")

  return {
    ...actual,
    assertOnboardingAnalysisTablesAvailable:
      mockAssertOnboardingAnalysisTablesAvailable,
    authenticateOnboardingRequest: mockAuthenticateOnboardingRequest,
    createAuthenticatedOnboardingClient: mockCreateAuthenticatedOnboardingClient,
    startOnboardingAnalysisRun: mockStartOnboardingAnalysisRun,
  }
})

async function loadRoute() {
  const route = await import("@/app/api/onboarding/analysis/route")

  return route.POST
}

describe("POST /api/onboarding/analysis", () => {
  beforeEach(() => {
    vi.resetModules()
    mockAuthenticateOnboardingRequest.mockReset()
    mockAssertOnboardingAnalysisTablesAvailable.mockReset()
    mockCreateAuthenticatedOnboardingClient.mockReset()
    mockStartOnboardingAnalysisRun.mockReset()

    mockAuthenticateOnboardingRequest.mockResolvedValue({
      id: "user-1",
    })
    mockAssertOnboardingAnalysisTablesAvailable.mockResolvedValue(undefined)
    mockCreateAuthenticatedOnboardingClient.mockReturnValue({
      auth: {},
      database: {},
    })
    mockStartOnboardingAnalysisRun.mockResolvedValue({
      analysisId: "analysis-1",
      status: "crawling",
      warnings: [],
    })
  })

  it("returns 401 without auth", async () => {
    mockAuthenticateOnboardingRequest.mockResolvedValue(null)

    const POST = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/onboarding/analysis", {
        body: JSON.stringify({
          companyName: "Acme",
          projectId: "project-1",
          website: "https://acme.com",
        }),
        method: "POST",
      })
    )

    expect(response.status).toBe(401)
  })

  it("returns 400 for an invalid request body", async () => {
    const POST = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/onboarding/analysis", {
        body: JSON.stringify({
          companyName: "",
          projectId: "",
          website: "",
        }),
        headers: {
          Authorization: "Bearer token-123",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: {
        message: "Project ID is required",
      },
    })
  })

  it("starts the async analysis run for valid input", async () => {
    const POST = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/onboarding/analysis", {
        body: JSON.stringify({
          companyName: "Acme",
          projectId: "project-1",
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
      analysisId: "analysis-1",
      status: "crawling",
      warnings: [],
    })
    expect(mockCreateAuthenticatedOnboardingClient).toHaveBeenCalledWith(
      "Bearer token-123"
    )
    expect(mockAssertOnboardingAnalysisTablesAvailable).toHaveBeenCalledWith(
      "Bearer token-123"
    )
    expect(mockStartOnboardingAnalysisRun).toHaveBeenCalledWith(
      expect.objectContaining({
        auth: {},
        database: {},
      }),
      {
        companyName: "Acme",
        projectId: "project-1",
        website: "https://acme.com",
      }
    )
  })

  it("returns 500 with the migration error when analysis tables are unavailable", async () => {
    mockAssertOnboardingAnalysisTablesAvailable.mockRejectedValue(
      new Error(
        "The onboarding analysis tables are missing. Apply db/migrations/0004_onboarding_site_analysis.sql before using the crawl flow."
      )
    )

    const POST = await loadRoute()
    const response = await POST(
      new Request("http://localhost/api/onboarding/analysis", {
        body: JSON.stringify({
          companyName: "Acme",
          projectId: "project-1",
          website: "https://acme.com",
        }),
        headers: {
          Authorization: "Bearer token-123",
        },
        method: "POST",
      })
    )

    expect(response.status).toBe(500)
    await expect(response.json()).resolves.toEqual({
      error: {
        message:
          "The onboarding analysis tables are missing. Apply db/migrations/0004_onboarding_site_analysis.sql before using the crawl flow.",
      },
    })
    expect(mockCreateAuthenticatedOnboardingClient).not.toHaveBeenCalled()
    expect(mockStartOnboardingAnalysisRun).not.toHaveBeenCalled()
  })
})
