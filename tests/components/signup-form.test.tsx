import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mockReplace = vi.fn()
const mockSignUp = vi.fn()
const mockGetPublicAuthConfig = vi.fn()
const mockRefreshUser = vi.fn()

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
}))

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    isLoading: false,
    refreshUser: mockRefreshUser,
    signOut: vi.fn(),
    user: null,
  }),
}))

vi.mock("@/lib/insforge/browser-client", () => ({
  getInsforgeBrowserClient: () => ({
    auth: {
      getPublicAuthConfig: mockGetPublicAuthConfig,
      signUp: mockSignUp,
    },
  }),
}))

import { SignupForm } from "@/components/signup-form"

function renderSignupForm() {
  return render(<SignupForm />)
}

async function waitForConfigReady() {
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Create Account" })).not.toBeDisabled()
  )
}

beforeEach(() => {
  mockReplace.mockReset()
  mockSignUp.mockReset()
  mockGetPublicAuthConfig.mockReset()
  mockRefreshUser.mockReset()
  mockRefreshUser.mockResolvedValue({} as never)

  mockGetPublicAuthConfig.mockResolvedValue({
    data: {
      customOAuthProviders: [],
      oAuthProviders: [],
      requireEmailVerification: false,
      requireLowercase: true,
      requireNumber: true,
      requireSpecialChar: true,
      requireUppercase: true,
      resetPasswordMethod: "code",
      verifyEmailMethod: "code",
      passwordMinLength: 8,
    },
    error: null,
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe("SignupForm", () => {
  it("calls signUp with normalized values and redirects after refreshUser", async () => {
    const user = userEvent.setup()

    mockSignUp.mockResolvedValue({
      data: {
        accessToken: "token",
        user: { email: "test@example.com" },
      },
      error: null,
    })

    renderSignupForm()

    await waitFor(() =>
      expect(mockGetPublicAuthConfig).toHaveBeenCalledTimes(1)
    )
    await waitForConfigReady()

    await user.type(screen.getByLabelText("Full Name"), "Jane Doe")
    await user.type(screen.getByLabelText("Email"), "  JANE@EXAMPLE.COM ")
    await user.type(screen.getByLabelText("Password"), "StrongPass!123")
    await user.type(screen.getByLabelText("Confirm Password"), "StrongPass!123")
    await user.click(screen.getByRole("button", { name: "Create Account" }))

    await waitFor(() =>
      expect(mockSignUp).toHaveBeenCalledWith({
        email: "jane@example.com",
        name: "Jane Doe",
        password: "StrongPass!123",
        redirectTo: "http://localhost:3000/login",
      })
    )

    await waitFor(() => expect(mockRefreshUser).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/"))
  })

  it("blocks invalid email and shows a field error", async () => {
    const user = userEvent.setup()

    renderSignupForm()

    await waitFor(() =>
      expect(mockGetPublicAuthConfig).toHaveBeenCalledTimes(1)
    )
    await waitForConfigReady()

    await user.type(screen.getByLabelText("Full Name"), "Jane Doe")
    await user.type(screen.getByLabelText("Email"), "not-an-email")
    await user.type(screen.getByLabelText("Password"), "StrongPass!123")
    await user.type(screen.getByLabelText("Confirm Password"), "StrongPass!123")
    await user.click(screen.getByRole("button", { name: "Create Account" }))

    expect(mockSignUp).not.toHaveBeenCalled()
    expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument()
  })

  it("blocks weak passwords and shows a field error", async () => {
    const user = userEvent.setup()

    renderSignupForm()

    await waitFor(() =>
      expect(mockGetPublicAuthConfig).toHaveBeenCalledTimes(1)
    )
    await waitForConfigReady()

    await user.type(screen.getByLabelText("Full Name"), "Jane Doe")
    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Password"), "weak")
    await user.type(screen.getByLabelText("Confirm Password"), "weak")
    await user.click(screen.getByRole("button", { name: "Create Account" }))

    expect(mockSignUp).not.toHaveBeenCalled()
    expect(
      await screen.findByText("Password must be at least 12 characters long")
    ).toBeInTheDocument()
  })

  it("blocks password mismatch and shows a field error", async () => {
    const user = userEvent.setup()

    renderSignupForm()

    await waitFor(() =>
      expect(mockGetPublicAuthConfig).toHaveBeenCalledTimes(1)
    )
    await waitForConfigReady()

    await user.type(screen.getByLabelText("Full Name"), "Jane Doe")
    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Password"), "StrongPass!123")
    await user.type(screen.getByLabelText("Confirm Password"), "DifferentPass!123")
    await user.click(screen.getByRole("button", { name: "Create Account" }))

    expect(mockSignUp).not.toHaveBeenCalled()
    expect(await screen.findByText("Passwords do not match")).toBeInTheDocument()
  })

  it("disables submit while pending and shows submitting state", async () => {
    const user = userEvent.setup()

    mockSignUp.mockImplementation(() => new Promise(() => {}))

    renderSignupForm()

    await waitFor(() =>
      expect(mockGetPublicAuthConfig).toHaveBeenCalledTimes(1)
    )
    await waitForConfigReady()

    await user.type(screen.getByLabelText("Full Name"), "Jane Doe")
    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Password"), "StrongPass!123")
    await user.type(screen.getByLabelText("Confirm Password"), "StrongPass!123")
    await user.click(screen.getByRole("button", { name: "Create Account" }))

    expect(screen.getByRole("button", { name: "Creating account..." })).toBeDisabled()
  })

  it("renders SDK errors inline", async () => {
    const user = userEvent.setup()

    mockSignUp.mockResolvedValue({
      data: null,
      error: {
        message: "Email already exists",
      },
    })

    renderSignupForm()

    await waitFor(() =>
      expect(mockGetPublicAuthConfig).toHaveBeenCalledTimes(1)
    )
    await waitForConfigReady()

    await user.type(screen.getByLabelText("Full Name"), "Jane Doe")
    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Password"), "StrongPass!123")
    await user.type(screen.getByLabelText("Confirm Password"), "StrongPass!123")
    await user.click(screen.getByRole("button", { name: "Create Account" }))

    expect(await screen.findByText("Email already exists")).toBeInTheDocument()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  it("blocks submission when backend requires email verification", async () => {
    const user = userEvent.setup()

    mockGetPublicAuthConfig.mockResolvedValue({
      data: {
        customOAuthProviders: [],
        oAuthProviders: [],
        requireEmailVerification: true,
        requireLowercase: true,
        requireNumber: true,
        requireSpecialChar: true,
        requireUppercase: true,
        resetPasswordMethod: "code",
        verifyEmailMethod: "link",
        passwordMinLength: 8,
      },
      error: null,
    })

    renderSignupForm()

    await waitFor(() =>
      expect(mockGetPublicAuthConfig).toHaveBeenCalledTimes(1)
    )

    expect(
      await screen.findByText(/requires email verification/i)
    ).toBeInTheDocument()

    await user.type(screen.getByLabelText("Full Name"), "Jane Doe")
    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Password"), "StrongPass!123")
    await user.type(screen.getByLabelText("Confirm Password"), "StrongPass!123")
    await user.click(screen.getByRole("button", { name: "Create Account" }))

    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it("blocks submission when config fails to load", async () => {
    const user = userEvent.setup()

    mockGetPublicAuthConfig.mockResolvedValue({
      data: null,
      error: {
        message: "Config unavailable",
      },
    })

    renderSignupForm()

    await waitFor(() =>
      expect(mockGetPublicAuthConfig).toHaveBeenCalledTimes(1)
    )

    expect(await screen.findByText("Config unavailable")).toBeInTheDocument()

    await user.type(screen.getByLabelText("Full Name"), "Jane Doe")
    await user.type(screen.getByLabelText("Email"), "jane@example.com")
    await user.type(screen.getByLabelText("Password"), "StrongPass!123")
    await user.type(screen.getByLabelText("Confirm Password"), "StrongPass!123")
    await user.click(screen.getByRole("button", { name: "Create Account" }))

    expect(mockSignUp).not.toHaveBeenCalled()
  })
})
