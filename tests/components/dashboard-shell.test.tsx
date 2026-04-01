import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TooltipProvider } from "@/components/ui/tooltip"

const mockReplace = vi.fn()
const mockUseAuth = vi.fn()

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
    mockUseAuth.mockReturnValue({
      isLoading: true,
      refreshUser: vi.fn(),
      signOut: vi.fn(),
      user: null,
    })

    const { DashboardShell } = await import("@/components/dashboard-shell")

    renderDashboardShell(DashboardShell)

    expect(screen.getByText("Checking your session...")).toBeInTheDocument()
  })

  it("redirects guests to /login", async () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      refreshUser: vi.fn(),
      signOut: vi.fn(),
      user: null,
    })

    const { DashboardShell } = await import("@/components/dashboard-shell")

    renderDashboardShell(DashboardShell)

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"))
    expect(screen.getByText("Redirecting...")).toBeInTheDocument()
  })

  it("renders the dashboard content for authenticated users", async () => {
    mockUseAuth.mockReturnValue({
      isLoading: false,
      refreshUser: vi.fn(),
      signOut: vi.fn(),
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

    const { DashboardShell } = await import("@/components/dashboard-shell")

    renderDashboardShell(DashboardShell)

    expect(screen.getByText("Dashboard content")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument()
  })
})
