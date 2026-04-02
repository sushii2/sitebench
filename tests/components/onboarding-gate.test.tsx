import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mockReplace = vi.fn()
const mockUseAuth = vi.fn()

function makeAuthState(overrides: Record<string, unknown> = {}) {
  return {
    authenticatedRedirectPath: null,
    brand: null,
    brandStatus: "ready",
    brandStatusError: null,
    isLoading: false,
    needsOnboarding: false,
    refreshAuthState: vi.fn(),
    refreshUser: vi.fn(),
    signOut: vi.fn(),
    user: null,
    ...overrides,
  }
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}))

vi.mock("@/lib/insforge/browser-client", () => ({
  getInsforgeBrowserClient: () => ({
    auth: {},
    database: {},
  }),
}))

describe("OnboardingGate", () => {
  beforeEach(() => {
    mockReplace.mockReset()
    mockUseAuth.mockReset()
  })

  async function renderOnboardingGate() {
    const { OnboardingGate } = await import("@/components/onboarding-gate")

    return render(<OnboardingGate />)
  }

  it("shows a loading state while brand status resolves", async () => {
    mockUseAuth.mockReturnValue(makeAuthState({ isLoading: true }))

    await renderOnboardingGate()

    expect(screen.getByText("Checking your setup...")).toBeInTheDocument()
  })

  it("redirects guests to /login", async () => {
    mockUseAuth.mockReturnValue(makeAuthState())

    await renderOnboardingGate()

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"))
  })

  it("redirects completed users to /dashboard", async () => {
    mockUseAuth.mockReturnValue(
      makeAuthState({
        authenticatedRedirectPath: "/dashboard",
        brand: {
          company_name: "Acme",
          competitors: [],
          created_at: "2026-01-01T00:00:00.000Z",
          description: "Description",
          id: "brand-1",
          onboarding_completed_at: "2026-01-02T00:00:00.000Z",
          topics: ["ai search", "perplexity", "google ai mode"],
          updated_at: "2026-01-01T00:00:00.000Z",
          user_id: "user-1",
          website: "https://acme.com",
        },
        user: {
          id: "user-1",
          email: "jane@example.com",
          emailVerified: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          metadata: null,
          profile: null,
        },
      })
    )

    await renderOnboardingGate()

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"))
  })

  it("renders the onboarding entry state for incomplete users", async () => {
    mockUseAuth.mockReturnValue(
      makeAuthState({
        authenticatedRedirectPath: "/onboarding",
        needsOnboarding: true,
        user: {
          id: "user-1",
          email: "jane@example.com",
          emailVerified: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          metadata: null,
          profile: null,
        },
      })
    )

    await renderOnboardingGate()

    expect(screen.getAllByText("Brand basics").length).toBeGreaterThan(0)
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("shows an error state when brand status fails to load", async () => {
    mockUseAuth.mockReturnValue(
      makeAuthState({
        brandStatus: "error",
        brandStatusError: "Unable to load your brand setup.",
        user: {
          id: "user-1",
          email: "jane@example.com",
          emailVerified: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          metadata: null,
          profile: null,
        },
      })
    )

    await renderOnboardingGate()

    expect(
      screen.getByText("Unable to load your brand setup.")
    ).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
