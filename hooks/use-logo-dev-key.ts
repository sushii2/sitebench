"use client"

import * as React from "react"

import { resolveLogoDevPublicConfig } from "@/lib/logo-dev/config"

export function useLogoDevPublishableKey(): string | null {
  return React.useMemo(() => {
    try {
      return resolveLogoDevPublicConfig().publishableKey
    } catch {
      return null
    }
  }, [])
}
