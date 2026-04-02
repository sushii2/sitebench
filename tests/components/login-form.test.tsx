import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockReplace = vi.fn()
const mockSignIn = vi.fn()
const mockRefreshAuthState = vi.fn()

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
    auth: {
      signInWithPassword: mockSignIn,
    },
  }),
}))

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}))

import { LoginForm } from "@/components/login-form"

type AuthState = {
  authenticatedRedirectPath: "/dashboard" | "/onboarding" | null
  brand: null
  brandStatus: "loading" | "ready" | "error"
  brandStatusError: string | null
  isLoading: boolean
  needsOnboarding: boolean
  refreshAuthState: ReturnType<typeof vi.fn>
  refreshUser: ReturnType<typeof vi.fn>
  signOut: ReturnType<typeof vi.fn>
  user: { email: string } | null
}

const authState: AuthState = {
  authenticatedRedirectPath: null,
  brand: null,
  brandStatus: "ready",
  brandStatusError: null,
  isLoading: false,
  needsOnboarding: false,
  refreshAuthState: mockRefreshAuthState,
  refreshUser: vi.fn(),
  signOut: vi.fn(),
  user: null,
}

function mockUseAuth() {
  return authState
}

function renderLoginForm() {
  return render(<LoginForm />)
}

beforeEach(() => {
  mockReplace.mockReset()
  mockSignIn.mockReset()
  mockRefreshAuthState.mockReset()
  authState.isLoading = false
  authState.authenticatedRedirectPath = null
  authState.brand = null
  authState.brandStatus = "ready"
  authState.brandStatusError = null
  authState.needsOnboarding = false
  authState.user = null
  authState.refreshAuthState = mockRefreshAuthState
  authState.refreshUser = vi.fn()
  authState.signOut = vi.fn()
  mockRefreshAuthState.mockResolvedValue({
    authenticatedRedirectPath: "/dashboard",
    brand: null,
    brandStatus: "ready",
    brandStatusError: null,
    needsOnboarding: false,
    user: { email: "jane@example.com" },
  } as never)
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("LoginForm", () => {
  it("blocks invalid email and shows a field error", async () => {
    const user = userEvent.setup()

    renderLoginForm()

    await user.type(screen.getByLabelText("Email"), "not-an-email")
    await user.type(screen.getByLabelText("Password"), "Password123!")
    await user.click(screen.getByRole("button", { name: "Log In" }))

    expect(mockSignIn).not.toHaveBeenCalled()
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument()
  })

  it("blocks empty password and shows a field error", async () => {
    const user = userEvent.setup()

    renderLoginForm()

    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.click(screen.getByRole("button", { name: "Log In" }))

    expect(mockSignIn).not.toHaveBeenCalled()
    expect(await screen.findByText("Enter your password")).toBeInTheDocument()
  })

  it("renders SDK errors inline for bad credentials", async () => {
    const user = userEvent.setup()

    mockSignIn.mockResolvedValue({
      data: null,
      error: { message: "Invalid email or password" },
    })

    renderLoginForm()

    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Password"), "Password123!")
    await user.click(screen.getByRole("button", { name: "Log In" }))

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument()
  })

  it("shows pending state while sign-in is in flight", async () => {
    const user = userEvent.setup()

    mockSignIn.mockImplementation(() => new Promise(() => {}))

    renderLoginForm()

    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Password"), "Password123!")
    await user.click(screen.getByRole("button", { name: "Log In" }))

    expect(screen.getByRole("button", { name: "Signing in..." })).toBeDisabled()
  })

  it("calls signInWithPassword with normalized email, refreshes auth, and redirects", async () => {
    const user = userEvent.setup()

    mockSignIn.mockResolvedValue({
      data: {
        accessToken: "token",
        user: { email: "jane@example.com" },
      },
      error: null,
    })

    renderLoginForm()

    await user.type(screen.getByLabelText("Email"), "  JANE@EXAMPLE.COM ")
    await user.type(screen.getByLabelText("Password"), "Password123!")
    await user.click(screen.getByRole("button", { name: "Log In" }))

    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith({
        email: "jane@example.com",
        password: "Password123!",
      })
    )

    await waitFor(() => expect(mockRefreshAuthState).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"))
  })

  it("redirects successful sign-in to onboarding when setup is incomplete", async () => {
    const user = userEvent.setup()

    mockSignIn.mockResolvedValue({
      data: {
        accessToken: "token",
        user: { email: "jane@example.com" },
      },
      error: null,
    })
    mockRefreshAuthState.mockResolvedValue({
      authenticatedRedirectPath: "/onboarding",
      brand: null,
      brandStatus: "ready",
      brandStatusError: null,
      needsOnboarding: true,
      user: { email: "jane@example.com" },
    } as never)

    renderLoginForm()

    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Password"), "Password123!")
    await user.click(screen.getByRole("button", { name: "Log In" }))

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/onboarding"))
  })

  it("shows a brand status error instead of redirecting when refreshAuthState fails", async () => {
    const user = userEvent.setup()

    mockSignIn.mockResolvedValue({
      data: {
        accessToken: "token",
        user: { email: "jane@example.com" },
      },
      error: null,
    })
    mockRefreshAuthState.mockResolvedValue({
      authenticatedRedirectPath: null,
      brand: null,
      brandStatus: "error",
      brandStatusError: "Unable to load your brand setup.",
      needsOnboarding: false,
      user: { email: "jane@example.com" },
    } as never)

    renderLoginForm()

    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Password"), "Password123!")
    await user.click(screen.getByRole("button", { name: "Log In" }))

    expect(
      await screen.findByText("Unable to load your brand setup.")
    ).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("redirects authenticated users away from the login page", async () => {
    authState.user = { email: "jane@example.com" }
    authState.authenticatedRedirectPath = "/dashboard"

    renderLoginForm()

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/dashboard"))
  })
})
