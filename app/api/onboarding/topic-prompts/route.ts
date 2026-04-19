import { NextResponse } from "next/server"

import {
  authenticateOnboardingRequest,
  createAuthenticatedOnboardingClient,
  generateTopicPromptCollection,
  onboardingTopicPromptRequestSchema,
} from "@/lib/onboarding"
import { listSiteCrawlPagesByRun } from "@/lib/site-crawl-pages/repository"

function createErrorResponse(message: string, status: number) {
  return NextResponse.json(
    {
      error: {
        message,
      },
    },
    { status }
  )
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null)
  const parsed = onboardingTopicPromptRequestSchema.safeParse(body)

  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request body."

    return createErrorResponse(message, 400)
  }

  const authorization = request.headers.get("Authorization")
  const user = await authenticateOnboardingRequest(authorization)

  if (!user) {
    return createErrorResponse("You must be signed in to continue.", 401)
  }

  console.log("[onboarding] Generating topic prompt drafts", {
    analysisRunId: parsed.data.analysisRunId,
    topicCount: parsed.data.topics?.length ?? 0,
    userId: user.id,
  })

  try {
    const client = createAuthenticatedOnboardingClient(authorization)
    const pages = await listSiteCrawlPagesByRun(client, parsed.data.analysisRunId)
    const result = await generateTopicPromptCollection({
      ...parsed.data,
      scrapedPages: pages.map((page) => ({
        competitorCandidates: Array.isArray(
          (page.competitor_candidates_json as { competitors?: unknown }).competitors
        )
          ? ((page.competitor_candidates_json as { competitors: unknown[] }).competitors
              .filter(
                (competitor): competitor is { name: string; website: string } =>
                  typeof competitor === "object" &&
                  competitor !== null &&
                  typeof (competitor as { name?: unknown }).name === "string" &&
                  typeof (competitor as { website?: unknown }).website === "string"
              )
              .map((competitor) => ({
                name: competitor.name,
                website: competitor.website,
              })))
          : [],
        contentSnapshot: page.content_snapshot,
        entities: Array.isArray(
          (page.entities_json as { entities?: unknown }).entities
        )
          ? ((page.entities_json as { entities: unknown[] }).entities.filter(
              (entity): entity is string => typeof entity === "string"
            ))
          : [],
        evidenceSnippets: Array.isArray(
          (page.entities_json as { evidenceSnippets?: unknown }).evidenceSnippets
        )
          ? ((page.entities_json as { evidenceSnippets: unknown[] }).evidenceSnippets.filter(
              (snippet): snippet is string => typeof snippet === "string"
            ))
          : [],
        intents: Array.isArray(
          (page.intents_json as { intents?: unknown }).intents
        )
          ? ((page.intents_json as { intents: unknown[] }).intents.filter(
              (intent): intent is string => typeof intent === "string"
            ))
          : [],
        pageType: page.page_type,
        title: page.title,
        url: page.canonical_url,
      })),
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error("[onboarding] Catalog refresh failed", error)

    return createErrorResponse(
      error instanceof Error
        ? error.message
        : "Unable to generate onboarding prompts.",
      502
    )
  }
}
