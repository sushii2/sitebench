import Firecrawl from "@mendable/firecrawl-js"

import { normalizeWebsite } from "@/lib/brands"
import { getOnboardingConfig } from "@/lib/onboarding/config"
import {
  onboardingScrapeContextSchema,
  type OnboardingScrapeContext,
} from "@/lib/onboarding/types"

const MAX_MARKDOWN_PREVIEW_CHARS = 1500

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
