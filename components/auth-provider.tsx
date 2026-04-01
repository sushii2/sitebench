"use client"

import * as React from "react"
import type { UserSchema } from "@insforge/sdk"

import { getInsforgeBrowserClient } from "@/lib/insforge/browser-client"

type AuthContextValue = {
  isLoading: boolean
  refreshUser: () => Promise<UserSchema | null>
  signOut: () => Promise<void>
  user: UserSchema | null
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = React.useState(true)
  const [user, setUser] = React.useState<UserSchema | null>(null)

  const refreshUser = React.useCallback(async () => {
    setIsLoading(true)

    try {
      const insforge = getInsforgeBrowserClient()
      const { data, error } = await insforge.auth.getCurrentUser()

      if (error) {
        setUser(null)
        return null
      }

      const nextUser = data.user ?? null

      setUser(nextUser)
      return nextUser
    } catch {
      setUser(null)
      return null
    } finally {
      setIsLoading(false)
    }
  }, [])

  const signOut = React.useCallback(async () => {
    const insforge = getInsforgeBrowserClient()

    await insforge.auth.signOut()
    setUser(null)
  }, [])

  React.useEffect(() => {
    void refreshUser()
  }, [refreshUser])

  return (
    <AuthContext.Provider
      value={{
        isLoading,
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
