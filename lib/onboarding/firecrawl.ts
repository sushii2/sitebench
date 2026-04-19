import Firecrawl from "@mendable/firecrawl-js"

import { normalizeWebsite, parsePublicWebsiteUrl } from "@/lib/brands"
import { getOnboardingConfig } from "@/lib/onboarding/config"
import {
  onboardingScrapeContextSchema,
  type OnboardingScrapeContext,
} from "@/lib/onboarding/types"

const MAX_MARKDOWN_PREVIEW_CHARS = 1500

export interface FirecrawlMappedLink {
  description?: string | null
  title?: string | null
  url: string
}

export interface FirecrawlCrawlDocument {
  html: string
  markdown: string
  metadata: Record<string, unknown>
  url: string
}

let firecrawlClient: Firecrawl | null = null

function getFirecrawlClient() {
  if (!firecrawlClient) {
    const { FIRECRAWL_API_KEY } = getOnboardingConfig()

    firecrawlClient = new Firecrawl({
      apiKey: FIRECRAWL_API_KEY,
    })
  }

  return firecrawlClient
}

function normalizePageUrl(url: string) {
  const parsed = parsePublicWebsiteUrl(url)

  if (!parsed) {
    throw new Error("Enter a valid website")
  }

  parsed.hash = ""

  return parsed.toString()
}

export async function mapWebsiteUrls(
  website: string,
  options?: {
    limit?: number
  }
): Promise<FirecrawlMappedLink[]> {
  const normalizedWebsite = normalizeWebsite(website)
  const result = await getFirecrawlClient().map(normalizedWebsite, {
    ignoreQueryParameters: true,
    limit: options?.limit ?? 500,
    location: {
      country: "US",
      languages: ["en-US"],
    },
    sitemap: "include",
  })

  return (result.links ?? [])
    .map((link) => ({
      description:
        typeof link.description === "string" ? link.description : null,
      title: typeof link.title === "string" ? link.title : null,
      url: normalizePageUrl(link.url),
    }))
    .filter((link) => Boolean(link.url))
}

export async function batchScrapePages(urls: string[]) {
  if (urls.length === 0) {
    return []
  }

  const job = await getFirecrawlClient().batchScrape(urls, {
    ignoreInvalidURLs: true,
    maxConcurrency: 4,
    options: {
      formats: ["markdown", "html"],
      onlyMainContent: true,
    },
    pollInterval: 1,
    timeout: 90,
  })

  return toFirecrawlDocuments(job.data ?? [])
}

export async function startOnboardingCrawl(input: {
  includePaths: string[]
  website: string
}) {
  const normalizedWebsite = normalizeWebsite(input.website)
  const job = await getFirecrawlClient().startCrawl(normalizedWebsite, {
    allowExternalLinks: false,
    allowSubdomains: false,
    crawlEntireDomain: true,
    ignoreQueryParameters: true,
    includePaths: input.includePaths,
    limit: Math.max(10, input.includePaths.length * 2),
    maxConcurrency: 2,
    maxDiscoveryDepth: 1,
    regexOnFullURL: false,
    scrapeOptions: {
      formats: ["markdown", "html"],
      onlyMainContent: true,
    },
    sitemap: "skip",
  })

  return job
}

export async function getOnboardingCrawlStatus(jobId: string) {
  return getFirecrawlClient().getCrawlStatus(jobId)
}

export function toFirecrawlDocuments(
  documents: Array<{
    html?: string | null
    markdown?: string | null
    metadata?: Record<string, unknown> | null
  }>
): FirecrawlCrawlDocument[] {
  return documents.flatMap((document) => {
    let url: string | null = null

    if (typeof document.metadata?.sourceURL === "string") {
      try {
        url = normalizePageUrl(document.metadata.sourceURL)
      } catch (error) {
        console.warn("[onboarding] Skipping crawl document with invalid source URL", {
          error,
          sourceURL: document.metadata.sourceURL,
        })
      }
    }

    if (!url) {
      return []
    }

    return [
      {
        html: document.html ?? "",
        markdown: document.markdown ?? "",
        metadata: document.metadata ?? {},
        url,
      },
    ]
  })
}

export async function scrapeBrandHomepage(
  website: string
): Promise<OnboardingScrapeContext> {
  const normalizedWebsite = normalizeWebsite(website)
  const document = await getFirecrawlClient().scrape(normalizedWebsite, {
    formats: ["markdown", "html"],
    onlyMainContent: true,
  })

  const context = onboardingScrapeContextSchema.parse({
    html: document.html ?? "",
    markdown: document.markdown ?? "",
    url:
      typeof document.metadata?.sourceURL === "string"
        ? document.metadata.sourceURL
        : normalizedWebsite,
  })

  console.log("[onboarding] Firecrawl scrape context", {
    htmlLength: context.html.length,
    markdownLength: context.markdown.length,
    markdownPreview: context.markdown.slice(0, MAX_MARKDOWN_PREVIEW_CHARS),
    url: context.url,
  })

  return context
}
