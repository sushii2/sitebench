import { createClient, type UserSchema } from "@insforge/sdk"

import { resolveInsforgePublicConfig } from "@/lib/insforge/config"

export function extractPromptPipelineBearerToken(authorization: string | null) {
  if (!authorization) {
    return null
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i)

  return match?.[1]?.trim() ?? null
}

export function createPromptPipelineServerClient() {
  const { anonKey, baseUrl } = resolveInsforgePublicConfig()

  return createClient({
    anonKey,
    baseUrl,
    isServerMode: true,
  })
}

export function createAuthenticatedPromptPipelineClient(
  authorization: string | null
) {
  const token = extractPromptPipelineBearerToken(authorization)

  if (!token) {
    throw new Error("You must be signed in to continue.")
  }

  const { anonKey, baseUrl } = resolveInsforgePublicConfig()

  return createClient({
    anonKey,
    baseUrl,
    edgeFunctionToken: token,
    isServerMode: true,
  })
}

export async function authenticatePromptPipelineRequest(
  authorization: string | null
): Promise<UserSchema | null> {
  const token = extractPromptPipelineBearerToken(authorization)

  if (!token) {
    return null
  }

  const client = createAuthenticatedPromptPipelineClient(authorization)
  const { data, error } = await client.auth.getCurrentUser()

  if (error || !data.user) {
    return null
  }

  return data.user
}
