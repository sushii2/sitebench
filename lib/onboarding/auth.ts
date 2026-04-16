import { createClient, type UserSchema } from "@insforge/sdk"

import { resolveInsforgePublicConfig } from "@/lib/insforge/config"

export function extractBearerToken(authorization: string | null) {
  if (!authorization) {
    return null
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i)

  return match?.[1]?.trim() || null
}

export function createAuthenticatedOnboardingClient(authorization: string | null) {
  const token = extractBearerToken(authorization)

  if (!token) {
    throw new Error("You must be signed in to continue.")
  }

  const { baseUrl } = resolveInsforgePublicConfig()

  return createClient({
    baseUrl,
    edgeFunctionToken: token,
    isServerMode: true,
  })
}

export async function authenticateOnboardingRequest(
  authorization: string | null
): Promise<UserSchema | null> {
  const token = extractBearerToken(authorization)

  if (!token) {
    return null
  }

  const client = createAuthenticatedOnboardingClient(authorization)

  const { data, error } = await client.auth.getCurrentUser()

  if (error || !data.user) {
    return null
  }

  return data.user
}
