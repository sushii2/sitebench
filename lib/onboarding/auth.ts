import { createClient, type UserSchema } from "@insforge/sdk"

import { resolveInsforgePublicConfig } from "@/lib/insforge/config"

const MISSING_ANALYSIS_TABLES_MESSAGE =
  "The onboarding analysis tables are missing. Apply db/migrations/0004_onboarding_site_analysis.sql and db/migrations/0005_onboarding_workflow_analysis.sql before using the crawl flow."

export function extractBearerToken(authorization: string | null) {
  if (!authorization) {
    return null
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i)

  return match?.[1]?.trim() || null
}

export function createAuthenticatedOnboardingClientFromToken(token: string | null) {
  if (!token) {
    throw new Error("You must be signed in to continue.")
  }

  const { anonKey, baseUrl } = resolveInsforgePublicConfig()

  return createClient({
    anonKey,
    baseUrl,
    debug: (message: string, ...args: unknown[]) => {
      console.log("[onboarding][insforge]", message, ...args)
    },
    edgeFunctionToken: token,
    isServerMode: true,
  })
}

export function createAuthenticatedOnboardingClient(authorization: string | null) {
  return createAuthenticatedOnboardingClientFromToken(
    extractBearerToken(authorization)
  )
}

function extractSchemaProbeMessage(bodyText: string) {
  if (!bodyText.trim()) {
    return null
  }

  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown>
    const message =
      typeof parsed.message === "string"
        ? parsed.message
        : parsed.error &&
            typeof parsed.error === "object" &&
            parsed.error !== null &&
            typeof (parsed.error as Record<string, unknown>).message === "string"
          ? ((parsed.error as Record<string, unknown>).message as string)
          : null

    return message ?? bodyText
  } catch {
    return bodyText
  }
}

function isMissingAnalysisTableResponse(tableName: string, status: number, message: string | null) {
  const normalizedMessage = message?.toLowerCase() ?? ""

  return (
    status === 404 ||
    (normalizedMessage.includes(tableName.toLowerCase()) &&
      (normalizedMessage.includes("does not exist") ||
        normalizedMessage.includes("not found") ||
        normalizedMessage.includes("relation")))
  )
}

export async function assertOnboardingAnalysisTablesAvailable(
  authorization: string | null
) {
  const token = extractBearerToken(authorization)

  if (!token) {
    throw new Error("You must be signed in to continue.")
  }

  const { baseUrl } = resolveInsforgePublicConfig()

  for (const tableName of [
    "site_crawl_runs",
    "site_crawl_pages",
    "site_crawl_mapped_pages",
  ]) {
    const response = await fetch(
      `${baseUrl}/api/database/records/${tableName}?select=id&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )
    const bodyText = await response.text()
    const message = extractSchemaProbeMessage(bodyText)

    if (response.ok) {
      continue
    }

    if (isMissingAnalysisTableResponse(tableName, response.status, message)) {
      throw new Error(MISSING_ANALYSIS_TABLES_MESSAGE)
    }

    throw new Error(
      message
        ? `Unable to verify onboarding analysis schema for ${tableName}. ${message}`
        : `Unable to verify onboarding analysis schema for ${tableName}.`
    )
  }
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
