import { beforeEach, describe, expect, it, vi } from "vitest"

const mockScrape = vi.fn()

vi.mock("@/lib/onboarding/config", () => ({
  getOnboardingConfig: () => ({
    FIRECRAWL_API_KEY: "fc-key",
  }),
}))

vi.mock("@mendable/firecrawl-js", () => ({
  default: class Firecrawl {
    scrape = mockScrape
  },
}))

async function loadFirecrawlModule() {
  return import("@/lib/onboarding/firecrawl")
}

describe("scrapeBrandHomepage", () => {
  beforeEach(() => {
    vi.resetModules()
    mockScrape.mockReset()
  })

  it("returns raw url, markdown, and html context for downstream normalization", async () => {
    mockScrape.mockResolvedValue({
      html: "<html><body><h1>Acme</h1><p>Acme helps marketing teams improve AI search visibility.</p></body></html>",
      markdown: "# Acme\n\nAcme helps marketing teams improve AI search visibility.\n\n" + "x".repeat(2000),
      metadata: {
        sourceURL: "https://www.acme.com",
      },
    })

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    const { scrapeBrandHomepage } = await loadFirecrawlModule()

    const result = await scrapeBrandHomepage("acme.com")

    expect(result).toEqual({
      html: "<html><body><h1>Acme</h1><p>Acme helps marketing teams improve AI search visibility.</p></body></html>",
      markdown: "# Acme\n\nAcme helps marketing teams improve AI search visibility.\n\n" + "x".repeat(2000),
      url: "https://www.acme.com",
    })
    expect(logSpy).toHaveBeenCalledWith(
      "[onboarding] Firecrawl scrape context",
      expect.objectContaining({
        htmlLength: result.html.length,
        markdownLength: result.markdown.length,
        markdownPreview: result.markdown.slice(0, 1500),
        url: "https://www.acme.com",
      })
    )

    logSpy.mockRestore()
  })

  it("retries empty scrape responses before failing with a manual follow-up message", async () => {
    mockScrape.mockResolvedValue({})

    const { scrapeBrandHomepageArtifact } = await loadFirecrawlModule()

    await expect(scrapeBrandHomepageArtifact("acme.com")).rejects.toThrow(
      "Failed to fetch brand profile. Continue manually."
    )
    expect(mockScrape).toHaveBeenCalledTimes(4)
  })

  it("uses the first non-empty scrape response after transient empty responses", async () => {
    mockScrape
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({
        html: "<html><body><h1>Acme</h1></body></html>",
        markdown: "# Acme",
        metadata: {
          sourceURL: "https://www.acme.com",
        },
      })

    const { scrapeBrandHomepageArtifact } = await loadFirecrawlModule()

    await expect(scrapeBrandHomepageArtifact("acme.com")).resolves.toMatchObject({
      domain: "acme.com",
      homepageUrl: "https://www.acme.com",
      html: "<html><body><h1>Acme</h1></body></html>",
      markdown: "# Acme",
      normalizedHomepageUrl: "https://www.acme.com/",
    })
    expect(mockScrape).toHaveBeenCalledTimes(2)
  })

  it("omits duplicated homepage bodies from the raw Firecrawl payload", async () => {
    mockScrape.mockResolvedValue({
      html: "<html><body><h1>Acme</h1></body></html>",
      markdown: "# Acme",
      metadata: {
        sourceURL: "https://www.acme.com",
        title: "Acme",
      },
      statusCode: 200,
      warning: "cached",
    })

    const { scrapeBrandHomepageArtifact } = await loadFirecrawlModule()

    const artifact = await scrapeBrandHomepageArtifact("acme.com")

    expect(artifact).toMatchObject({
      rawFirecrawlResponse: {
        metadata: {
          sourceURL: "https://www.acme.com",
          title: "Acme",
        },
        statusCode: 200,
        warning: "cached",
      },
    })

    expect(artifact.rawFirecrawlResponse).not.toHaveProperty("html")
    expect(artifact.rawFirecrawlResponse).not.toHaveProperty("markdown")
  })
})

describe("toFirecrawlDocuments", () => {
  it("skips documents with invalid source URLs instead of throwing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    const { toFirecrawlDocuments } = await loadFirecrawlModule()

    const result = toFirecrawlDocuments([
      {
        html: "<p>Broken</p>",
        markdown: "Broken",
        metadata: {
          sourceURL: "::::",
        },
      },
      {
        html: "<p>Valid</p>",
        markdown: "Valid",
        metadata: {
          sourceURL: "https://acme.com/pricing",
        },
      },
    ])

    expect(result).toEqual([
      {
        html: "<p>Valid</p>",
        markdown: "Valid",
        metadata: {
          sourceURL: "https://acme.com/pricing",
        },
        url: "https://acme.com/pricing",
      },
    ])
    expect(warnSpy).toHaveBeenCalledWith(
      "[onboarding] Skipping crawl document with invalid source URL",
      expect.objectContaining({
        sourceURL: "::::",
      })
    )

    warnSpy.mockRestore()
  })
})
