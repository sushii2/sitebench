import * as React from "react"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { mockGetCurrentUser, mockLoadCurrentUserBrand } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockLoadCurrentUserBrand: vi.fn(),
}))

vi.mock("@/lib/insforge/browser-client", () => ({
  getInsforgeBrowserClient: () => ({
    auth: {
      getCurrentUser: mockGetCurrentUser,
      signOut: vi.fn(),
    },
  }),
}))

vi.mock("@/lib/brands", async () => {
  const actual = await vi.importActual<typeof import("@/lib/brands")>(
    "@/lib/brands"
  )

  return {
    ...actual,
    loadCurrentUserBrand: mockLoadCurrentUserBrand,
  }
})

import { AuthProvider, useAuth } from "@/components/auth-provider"

function makeUser() {
  return {
    id: "user-1",
    email: "jane@example.com",
    emailVerified: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    metadata: null,
    profile: null,
  }
}

function Probe() {
  const auth = useAuth()

  return (
    <div>
      <div data-testid="brand-status">{auth.brandStatus}</div>
      <div data-testid="brand-status-error">{auth.brandStatusError ?? ""}</div>
      <div data-testid="authenticated-redirect-path">
        {auth.authenticatedRedirectPath ?? ""}
      </div>
      <div data-testid="needs-onboarding">{String(auth.needsOnboarding)}</div>
      <div data-testid="is-loading">{String(auth.isLoading)}</div>
    </div>
  )
}

describe("AuthProvider", () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReset()
    mockLoadCurrentUserBrand.mockReset()
  })

  it("exposes a brand status error instead of treating a brand load failure as onboarding", async () => {
    mockGetCurrentUser.mockResolvedValue({
      data: {
        user: makeUser(),
      },
      error: null,
    })
    mockLoadCurrentUserBrand.mockRejectedValue(
      new Error("Unable to load brand status.")
    )

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    )

    await waitFor(() =>
      expect(mockLoadCurrentUserBrand).toHaveBeenCalledTimes(1)
    )

    expect(screen.getByTestId("brand-status")).toHaveTextContent("error")
    expect(screen.getByTestId("brand-status-error")).toHaveTextContent(
      "Unable to load brand status."
    )
    expect(screen.getByTestId("authenticated-redirect-path")).toHaveTextContent("")
    expect(screen.getByTestId("needs-onboarding")).toHaveTextContent("false")
    expect(screen.getByTestId("is-loading")).toHaveTextContent("false")
  })
})
