import type { InsForgeClient } from "@insforge/sdk"

import type { SiteCrawlMappedPage } from "@/lib/site-crawl-mapped-pages/types"

type SiteCrawlMappedPageClient = Pick<InsForgeClient, "database">

function takeRows<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

export async function listSiteCrawlMappedPagesByRun(
  client: SiteCrawlMappedPageClient,
  runId: string
): Promise<SiteCrawlMappedPage[]> {
  const response = await client.database
    .from("site_crawl_mapped_pages")
    .select("*")
    .eq("crawl_run_id", runId)
    .order("candidate_score", { ascending: false })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load mapped crawl pages.")
  }

  return takeRows(response.data as SiteCrawlMappedPage[] | SiteCrawlMappedPage | null)
}

export async function replaceSiteCrawlMappedPages(
  client: SiteCrawlMappedPageClient,
  runId: string,
  projectId: string,
  pages: Array<
    Omit<
      SiteCrawlMappedPage,
      "crawl_run_id" | "created_at" | "id" | "project_id" | "updated_at"
    >
  >
): Promise<SiteCrawlMappedPage[]> {
  const deleteResponse = await client.database
    .from("site_crawl_mapped_pages")
    .delete()
    .eq("crawl_run_id", runId)

  if (!deleteResponse || deleteResponse.error) {
    throw deleteResponse?.error ?? new Error("Unable to replace mapped crawl pages.")
  }

  if (pages.length === 0) {
    return []
  }

  const response = await client.database
    .from("site_crawl_mapped_pages")
    .insert(
      pages.map((page) => ({
        candidate_bucket: page.candidate_bucket,
        candidate_reason: page.candidate_reason,
        candidate_score: page.candidate_score,
        canonical_url: page.canonical_url,
        crawl_run_id: runId,
        meta_description: page.meta_description,
        project_id: projectId,
        title: page.title,
      }))
    )
    .select("*")

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to replace mapped crawl pages.")
  }

  return takeRows(response.data as SiteCrawlMappedPage[] | SiteCrawlMappedPage | null)
}
