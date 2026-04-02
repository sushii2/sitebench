"use client"

import * as React from "react"
import type { UserSchema } from "@insforge/sdk"

import { getInsforgeBrowserClient } from "@/lib/insforge/browser-client"
import { isOnboardingComplete, loadCurrentUserBrand, type BrandWithCompetitors } from "@/lib/brands"

type BrandStatus = "loading" | "ready" | "error"

type AuthContextValue = {
  authenticatedRedirectPath: "/dashboard" | "/onboarding" | null
  brand: BrandWithCompetitors | null
  brandStatus: BrandStatus
  brandStatusError: string | null
  isLoading: boolean
  needsOnboarding: boolean
  refreshAuthState: () => Promise<{
    authenticatedRedirectPath: "/dashboard" | "/onboarding" | null
    brand: BrandWithCompetitors | null
    brandStatus: BrandStatus
    brandStatusError: string | null
    needsOnboarding: boolean
    user: UserSchema | null
  }>
  refreshUser: () => Promise<UserSchema | null>
  signOut: () => Promise<void>
  user: UserSchema | null
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = React.useState(true)
  const [brand, setBrand] = React.useState<BrandWithCompetitors | null>(null)
  const [brandStatus, setBrandStatus] = React.useState<BrandStatus>("loading")
  const [brandStatusError, setBrandStatusError] = React.useState<string | null>(
    null
  )
  const [needsOnboarding, setNeedsOnboarding] = React.useState(false)
  const [user, setUser] = React.useState<UserSchema | null>(null)

  const refreshAuthState = React.useCallback(async () => {
    setIsLoading(true)
    setBrandStatus("loading")
    setBrandStatusError(null)

    try {
      const insforge = getInsforgeBrowserClient()
      const { data, error } = await insforge.auth.getCurrentUser()

      if (error) {
        setUser(null)
        setBrand(null)
        setNeedsOnboarding(false)
        setBrandStatus("ready")
        setBrandStatusError(null)

        return {
          authenticatedRedirectPath: null,
          brand: null,
          brandStatus: "ready" as const,
          brandStatusError: null,
          needsOnboarding: false,
          user: null,
        }
      }

      const nextUser = data.user ?? null

      setUser(nextUser)

      if (!nextUser) {
        setBrand(null)
        setNeedsOnboarding(false)
        setBrandStatus("ready")
        setBrandStatusError(null)

        return {
          authenticatedRedirectPath: null,
          brand: null,
          brandStatus: "ready" as const,
          brandStatusError: null,
          needsOnboarding: false,
          user: null,
        }
      }

      let nextBrand: BrandWithCompetitors | null = null
      let nextBrandStatus: BrandStatus = "ready"
      let nextBrandStatusError: string | null = null

      try {
        nextBrand = await loadCurrentUserBrand(insforge)
      } catch (error) {
        nextBrand = null
        nextBrandStatus = "error"
        nextBrandStatusError =
          error instanceof Error
            ? error.message
            : "Unable to load your brand setup."
      }

      const nextNeedsOnboarding =
        nextBrandStatus === "ready" &&
        (!nextBrand || !isOnboardingComplete(nextBrand))

      setBrand(nextBrand)
      setNeedsOnboarding(nextNeedsOnboarding)
      setBrandStatus(nextBrandStatus)
      setBrandStatusError(nextBrandStatusError)

      return {
        authenticatedRedirectPath:
          nextBrandStatus === "error"
            ? null
            : nextNeedsOnboarding
              ? ("/onboarding" as const)
              : ("/dashboard" as const),
        brand: nextBrand,
        brandStatus: nextBrandStatus,
        brandStatusError: nextBrandStatusError,
        needsOnboarding: nextNeedsOnboarding,
        user: nextUser,
      }
    } catch {
      setUser(null)
      setBrand(null)
      setBrandStatus("ready")
      setBrandStatusError(null)
      setNeedsOnboarding(false)

      return {
        authenticatedRedirectPath: null,
        brand: null,
        brandStatus: "ready" as const,
        brandStatusError: null,
        needsOnboarding: false,
        user: null,
      }
    } finally {
      setIsLoading(false)
    }
  }, [])

  const refreshUser = React.useCallback(async () => {
    const nextState = await refreshAuthState()

    return nextState.user
  }, [refreshAuthState])

  const signOut = React.useCallback(async () => {
    const insforge = getInsforgeBrowserClient()

    await insforge.auth.signOut()
    setUser(null)
    setBrand(null)
    setBrandStatus("ready")
    setBrandStatusError(null)
    setNeedsOnboarding(false)
  }, [])

  React.useEffect(() => {
    void refreshAuthState()
  }, [refreshAuthState])

  return (
    <AuthContext.Provider
      value={{
        authenticatedRedirectPath:
          user && brandStatus !== "error"
            ? needsOnboarding
              ? "/onboarding"
              : "/dashboard"
            : null,
        brand,
        brandStatus,
        brandStatusError,
        isLoading,
        needsOnboarding,
        refreshAuthState,
        refreshUser,
        signOut,
        user,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = React.useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }

  return context
}
