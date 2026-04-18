import type { InsForgeClient } from "@insforge/sdk"

import type { SiteCrawlPage } from "@/lib/site-crawl-pages/types"

type SiteCrawlPageClient = Pick<InsForgeClient, "database">

function takeRows<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

export async function listSiteCrawlPagesByRun(
  client: SiteCrawlPageClient,
  runId: string
): Promise<SiteCrawlPage[]> {
  const response = await client.database
    .from("site_crawl_pages")
    .select("*")
    .eq("crawl_run_id", runId)
    .order("selection_score", { ascending: false })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load crawl pages.")
  }

  return takeRows(response.data as SiteCrawlPage[] | SiteCrawlPage | null)
}

export async function replaceSiteCrawlPages(
  client: SiteCrawlPageClient,
  runId: string,
  projectId: string,
  pages: Array<
    Omit<SiteCrawlPage, "created_at" | "crawl_run_id" | "id" | "project_id" | "updated_at">
  >
): Promise<SiteCrawlPage[]> {
  const deleteResponse = await client.database
    .from("site_crawl_pages")
    .delete()
    .eq("crawl_run_id", runId)

  if (!deleteResponse || deleteResponse.error) {
    throw deleteResponse?.error ?? new Error("Unable to replace crawl pages.")
  }

  if (pages.length === 0) {
    return []
  }

  const response = await client.database
    .from("site_crawl_pages")
    .insert(
      pages.map((page) => ({
        canonical_url: page.canonical_url,
        competitor_candidates_json: page.competitor_candidates_json,
        content_snapshot: page.content_snapshot,
        crawl_run_id: runId,
        entities_json: page.entities_json,
        intents_json: page.intents_json,
        meta_description: page.meta_description,
        page_metadata_json: page.page_metadata_json,
        page_type: page.page_type,
        project_id: projectId,
        selection_reason: page.selection_reason,
        selection_score: page.selection_score,
        title: page.title,
      }))
    )
    .select("*")

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to replace crawl pages.")
  }

  return takeRows(response.data as SiteCrawlPage[] | SiteCrawlPage | null)
}
