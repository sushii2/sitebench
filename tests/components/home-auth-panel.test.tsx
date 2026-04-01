import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockGetCurrentUser = vi.fn()
const mockSignOut = vi.fn()

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))

vi.mock("@/lib/insforge/browser-client", () => ({
  getInsforgeBrowserClient: () => ({
    auth: {
      getCurrentUser: mockGetCurrentUser,
      signOut: mockSignOut,
    },
  }),
}))

import { AuthProvider } from "@/components/auth-provider"
import { HomeAuthPanel } from "@/components/home-auth-panel"

beforeEach(() => {
  mockGetCurrentUser.mockReset()
  mockSignOut.mockReset()
  mockSignOut.mockResolvedValue({
    error: null,
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

function renderHomeAuthPanel() {
  return render(
    <AuthProvider>
      <HomeAuthPanel />
    </AuthProvider>
  )
}

describe("HomeAuthPanel", () => {
  it("shows loading state while auth is resolving", () => {
    mockGetCurrentUser.mockImplementation(() => new Promise(() => {}))

    renderHomeAuthPanel()

    expect(screen.getByText("Checking your session...")).toBeInTheDocument()
  })

  it("shows anonymous CTAs when no persisted session exists", async () => {
    mockGetCurrentUser.mockResolvedValue({
      data: {
        user: null,
      },
      error: null,
    })

    renderHomeAuthPanel()

    expect(await screen.findByText("Welcome to Sitebench")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login")
    expect(screen.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/sign-up")
  })

  it("restores persisted auth state on mount", async () => {
    mockGetCurrentUser.mockResolvedValue({
      data: {
        user: {
          id: "123e4567-e89b-12d3-a456-426614174000",
          email: "jane@example.com",
          emailVerified: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          metadata: null,
          profile: null,
        },
      },
      error: null,
    })

    renderHomeAuthPanel()

    expect(await screen.findByText("Signed in as")).toBeInTheDocument()
    expect(screen.getByText("jane@example.com")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute(
      "href",
      "/dashboard"
    )
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument()
  })

  it("signs out and returns the UI to anonymous state", async () => {
    const user = userEvent.setup()

    mockGetCurrentUser.mockResolvedValue({
      data: {
        user: {
          id: "123e4567-e89b-12d3-a456-426614174000",
          email: "jane@example.com",
          emailVerified: true,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
          metadata: null,
          profile: null,
        },
      },
      error: null,
    })

    renderHomeAuthPanel()

    await screen.findByText("Signed in as")

    await user.click(screen.getByRole("button", { name: "Sign out" }))

    await waitFor(() => expect(mockSignOut).toHaveBeenCalledTimes(1))
    expect(await screen.findByText("Welcome to Sitebench")).toBeInTheDocument()
  })
})
