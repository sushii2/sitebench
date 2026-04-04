import { createClient, type UserSchema } from "@insforge/sdk"

import { resolveInsforgePublicConfig } from "@/lib/insforge/config"

function extractBearerToken(authorization: string | null) {
  if (!authorization) {
    return null
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i)

  return match?.[1]?.trim() || null
}

export async function authenticateOnboardingRequest(
  authorization: string | null
): Promise<UserSchema | null> {
  const token = extractBearerToken(authorization)

  if (!token) {
    return null
  }

  const { baseUrl } = resolveInsforgePublicConfig()
  const client = createClient({
    baseUrl,
    edgeFunctionToken: token,
    isServerMode: true,
  })

  const { data, error } = await client.auth.getCurrentUser()

  if (error || !data.user) {
    return null
  }

  return data.user
}

