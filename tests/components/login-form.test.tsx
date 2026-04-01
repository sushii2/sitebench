import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockReplace = vi.fn()
const mockSignIn = vi.fn()
const mockRefreshUser = vi.fn()

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
  isLoading: boolean
  refreshUser: ReturnType<typeof vi.fn>
  signOut: ReturnType<typeof vi.fn>
  user: { email: string } | null
}

const authState: AuthState = {
  isLoading: false,
  refreshUser: mockRefreshUser,
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
  mockRefreshUser.mockReset()
  authState.isLoading = false
  authState.user = null
  authState.refreshUser = mockRefreshUser
  authState.signOut = vi.fn()
  mockRefreshUser.mockResolvedValue({} as never)
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

    await waitFor(() => expect(mockRefreshUser).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"))
  })

  it("redirects authenticated users away from the login page", async () => {
    authState.user = { email: "jane@example.com" }

    renderLoginForm()

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"))
  })
})
