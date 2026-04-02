import * as React from "react"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { SidebarProvider } from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { BrandWithCompetitors } from "@/lib/brands"

const mockReplace = vi.fn()
const mockSignOut = vi.fn()
const mockUseAuth = vi.fn()
const mockUsePathname = vi.fn()

function makeBrand(
  overrides: Partial<BrandWithCompetitors> = {}
): BrandWithCompetitors {
  return {
    company_name: "Acme",
    competitors: [],
    created_at: "2026-01-01T00:00:00.000Z",
    description: "Description",
    id: "brand-1",
    onboarding_completed_at: "2026-01-02T00:00:00.000Z",
    topics: ["ai search", "google ai mode", "perplexity"],
    updated_at: "2026-01-01T00:00:00.000Z",
    user_id: "123e4567-e89b-12d3-a456-426614174000",
    website: "https://acme.com",
    ...overrides,
  }
}

vi.mock("next/navigation", () => ({
  usePathname: () => mockUsePathname(),
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

beforeEach(() => {
  mockReplace.mockReset()
  mockSignOut.mockReset()
  mockUsePathname.mockReset()
  mockUseAuth.mockReset()
  process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY = "pk_test_123"

  mockUsePathname.mockReturnValue("/dashboard/insights")
  mockUseAuth.mockReturnValue({
    brand: makeBrand(),
    brandStatus: "ready",
    isLoading: false,
    needsOnboarding: false,
    refreshUser: vi.fn(),
    refreshAuthState: vi.fn(),
    signOut: mockSignOut,
    user: {
      id: "123e4567-e89b-12d3-a456-426614174000",
      email: "jane@example.com",
      emailVerified: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      metadata: null,
      profile: null,
    },
  })
})

describe("DashboardSidebar", () => {
  function renderDashboardSidebar(
    DashboardSidebar: React.ComponentType,
    { open = true }: { open?: boolean } = {}
  ) {
    return render(
      <TooltipProvider>
        <SidebarProvider open={open} onOpenChange={() => {}}>
          <DashboardSidebar />
        </SidebarProvider>
      </TooltipProvider>
    )
  }

  it("renders the main navigation items and group labels", async () => {
    const { DashboardSidebar } = await import("@/components/dashboard-sidebar")

    renderDashboardSidebar(DashboardSidebar)

    for (const label of [
      "Home",
      "Prompts",
      "Chats",
      "Insights",
      "Sources",
      "Queries",
    ]) {
      expect(screen.getByRole("link", { name: label })).toBeInTheDocument()
    }

    for (const label of ["Tags", "Brands", "Cohorts"]) {
      expect(screen.getByText(label)).toBeInTheDocument()
      expect(
        screen.queryByRole("link", { name: label })
      ).not.toBeInTheDocument()
    }
  })

  it("marks the current route as active", async () => {
    const { DashboardSidebar } = await import("@/components/dashboard-sidebar")

    renderDashboardSidebar(DashboardSidebar)

    expect(screen.getByRole("link", { name: "Insights" })).toHaveAttribute(
      "aria-current",
      "page"
    )
  })

  it("shows the account fallback label with the signed in email", async () => {
    const { DashboardSidebar } = await import("@/components/dashboard-sidebar")

    renderDashboardSidebar(DashboardSidebar)

    expect(screen.getByText("Account")).toBeInTheDocument()
    expect(screen.getByText("jane@example.com")).toBeInTheDocument()
  })

  it("renders the current brand identity in the expanded sidebar header", async () => {
    const { DashboardSidebar } = await import("@/components/dashboard-sidebar")

    renderDashboardSidebar(DashboardSidebar)

    const brandHeader = screen.getByLabelText("Brand navigation for Acme")

    expect(within(brandHeader).getByText("Acme")).toBeInTheDocument()
    expect(within(brandHeader).getByText("https://acme.com")).toBeInTheDocument()
    expect(screen.queryByText("Sitebench")).not.toBeInTheDocument()
  })

  it("signs out and returns the user to the public home page", async () => {
    const user = userEvent.setup()
    mockSignOut.mockResolvedValue(undefined)

    const { DashboardSidebar } = await import("@/components/dashboard-sidebar")

    renderDashboardSidebar(DashboardSidebar)

    await user.click(screen.getByRole("button", { name: "Sign out" }))

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"))
  })

  it("uses the collapsed account menu to sign out without rendering overflow text", async () => {
    const user = userEvent.setup()
    mockSignOut.mockResolvedValue(undefined)
    mockUseAuth.mockReturnValue({
      brand: makeBrand({
        company_name: "Sidebar Labs",
        website: "https://sidebarlabs.com",
      }),
      brandStatus: "ready",
      isLoading: false,
      needsOnboarding: false,
      refreshUser: vi.fn(),
      refreshAuthState: vi.fn(),
      signOut: mockSignOut,
      user: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        email: "sidebar@example.com",
        emailVerified: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        metadata: null,
        profile: {
          name: "Sidebar Tester",
        },
      },
    })

    const { DashboardSidebar } = await import("@/components/dashboard-sidebar")

    renderDashboardSidebar(DashboardSidebar, { open: false })

    expect(screen.queryByText("Sidebar Labs")).not.toBeInTheDocument()
    expect(screen.queryByText("https://sidebarlabs.com")).not.toBeInTheDocument()
    expect(screen.queryByText("Tags")).not.toBeInTheDocument()
    expect(
      screen.queryByRole("button", { name: "Sign out" })
    ).not.toBeInTheDocument()
    expect(
      screen.getByLabelText("Brand navigation for Sidebar Labs")
    ).toBeInTheDocument()

    const accountMenuTrigger = screen.getByRole("button", {
      name: /account menu/i,
    })

    await user.hover(accountMenuTrigger)
    const signOutButton = await screen.findByRole("button", {
      name: /^sign out$/i,
    })

    await user.click(signOutButton)

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"))
  })

  it("closes the collapsed account hover menu after the pointer leaves it", async () => {
    const user = userEvent.setup()
    mockUseAuth.mockReturnValue({
      brand: makeBrand({
        company_name: "Sidebar Tester",
        website: "https://sidebar.example.com",
      }),
      brandStatus: "ready",
      isLoading: false,
      needsOnboarding: false,
      refreshUser: vi.fn(),
      refreshAuthState: vi.fn(),
      signOut: mockSignOut,
      user: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        email: "sidebar@example.com",
        emailVerified: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        metadata: null,
        profile: {
          name: "Sidebar Tester",
        },
      },
    })

    const { DashboardSidebar } = await import("@/components/dashboard-sidebar")

    renderDashboardSidebar(DashboardSidebar, { open: false })

    const accountMenuTrigger = screen.getByRole("button", {
      name: /account menu/i,
    })

    await user.hover(accountMenuTrigger)
    const signOutButton = await screen.findByRole("button", {
      name: /^sign out$/i,
    })

    await user.hover(signOutButton)

    await user.unhover(signOutButton)

    await waitFor(() => {
      expect(
        screen.queryByRole("button", { name: /^sign out$/i })
      ).not.toBeInTheDocument()
    })
  })

  it("falls back to a monogram when the brand logo cannot be resolved", async () => {
    mockUseAuth.mockReturnValue({
      brand: makeBrand({
        company_name: "Rocket Lab",
        website: "not-a-valid-url",
      }),
      brandStatus: "ready",
      isLoading: false,
      needsOnboarding: false,
      refreshUser: vi.fn(),
      refreshAuthState: vi.fn(),
      signOut: mockSignOut,
      user: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        email: "rocket@example.com",
        emailVerified: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        metadata: null,
        profile: {
          name: "Rocket Owner",
        },
      },
    })

    const { DashboardSidebar } = await import("@/components/dashboard-sidebar")

    renderDashboardSidebar(DashboardSidebar)

    const brandHeader = screen.getByLabelText("Brand navigation for Rocket Lab")

    expect(within(brandHeader).getByText("Rocket Lab")).toBeInTheDocument()
    expect(within(brandHeader).getByText("not-a-valid-url")).toBeInTheDocument()
    expect(within(brandHeader).getByText("RL")).toBeInTheDocument()
    expect(
      within(brandHeader).queryByRole("img", { name: "Rocket Lab logo" })
    ).not.toBeInTheDocument()
  })
})
