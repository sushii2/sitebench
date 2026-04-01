import { createClient } from "@insforge/sdk"

import { resolveInsforgePublicConfig } from "@/lib/insforge/config"

let browserClient: ReturnType<typeof createClient> | null = null

export function getInsforgeBrowserClient() {
  if (browserClient) {
    return browserClient
  }

  const { anonKey, baseUrl } = resolveInsforgePublicConfig()

  browserClient = createClient({
    anonKey,
    baseUrl,
  })

  return browserClient
}
