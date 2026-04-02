import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"

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
  usePathname: () => "/dashboard",
  useRouter: () => ({
    replace: mockReplace,
  }),
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => mockUseAuth(),
}))

describe("DashboardShell", () => {
  beforeEach(() => {
    mockReplace.mockReset()
    mockUseAuth.mockReset()
  })

  function renderDashboardShell(
    DashboardShell: React.ComponentType<{ children: React.ReactNode }>
  ) {
    return render(
      <TooltipProvider>
        <DashboardShell>
          <div>Dashboard content</div>
        </DashboardShell>
      </TooltipProvider>
    )
  }

  it("shows a loading state while auth is resolving", async () => {
    mockUseAuth.mockReturnValue(makeAuthState({ isLoading: true }))

    const { DashboardShell } = await import("@/components/dashboard-shell")

    renderDashboardShell(DashboardShell)

    expect(screen.getByText("Checking your session...")).toBeInTheDocument()
  })

  it("redirects guests to /login", async () => {
    mockUseAuth.mockReturnValue(makeAuthState())

    const { DashboardShell } = await import("@/components/dashboard-shell")

    renderDashboardShell(DashboardShell)

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"))
    expect(screen.getByText("Redirecting...")).toBeInTheDocument()
  })

  it("redirects authenticated users with incomplete onboarding to /onboarding", async () => {
    mockUseAuth.mockReturnValue(
      makeAuthState({
        authenticatedRedirectPath: "/onboarding",
        needsOnboarding: true,
        user: {
          id: "123e4567-e89b-12d3-a456-426614174000",
          email: "jane@example.com",
          emailVerified: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          metadata: null,
          profile: {
            name: "Jane Doe",
          },
        },
      })
    )

    const { DashboardShell } = await import("@/components/dashboard-shell")

    renderDashboardShell(DashboardShell)

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/onboarding"))
    expect(screen.getByText("Redirecting...")).toBeInTheDocument()
  })

  it("renders the dashboard content for authenticated users", async () => {
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
          user_id: "123e4567-e89b-12d3-a456-426614174000",
          website: "https://acme.com",
        },
        user: {
          id: "123e4567-e89b-12d3-a456-426614174000",
          email: "jane@example.com",
          emailVerified: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          metadata: null,
          profile: {
            name: "Jane Doe",
          },
        },
      })
    )

    const { DashboardShell } = await import("@/components/dashboard-shell")

    renderDashboardShell(DashboardShell)

    expect(screen.getByText("Dashboard content")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument()
  })

  it("shows an error state when brand status fails to load", async () => {
    mockUseAuth.mockReturnValue(
      makeAuthState({
        brandStatus: "error",
        brandStatusError: "Unable to load your brand setup.",
        user: {
          id: "123e4567-e89b-12d3-a456-426614174000",
          email: "jane@example.com",
          emailVerified: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          metadata: null,
          profile: {
            name: "Jane Doe",
          },
        },
      })
    )

    const { DashboardShell } = await import("@/components/dashboard-shell")

    renderDashboardShell(DashboardShell)

    expect(
      screen.getByText("Unable to load your brand setup.")
    ).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
