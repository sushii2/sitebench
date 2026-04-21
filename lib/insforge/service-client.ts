import "server-only"

import { createClient } from "@insforge/sdk"

import { resolveInsforgeServiceConfig } from "@/lib/insforge/config"

export function createInsforgeServiceClient() {
  const { apiKey, baseUrl } = resolveInsforgeServiceConfig()

  return createClient({
    anonKey: apiKey,
    baseUrl,
    isServerMode: true,
  })
}
