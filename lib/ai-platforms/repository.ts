import type { InsForgeClient } from "@insforge/sdk"

import type { AiPlatform } from "@/lib/ai-platforms/types"

type AiPlatformClient = Pick<InsForgeClient, "database">

function takeRows<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

export async function loadActiveAiPlatforms(
  client: AiPlatformClient
): Promise<AiPlatform[]> {
  const response = await client.database
    .from("ai_platforms")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load AI platforms.")
  }

  return takeRows(response.data as AiPlatform[] | AiPlatform | null)
}
