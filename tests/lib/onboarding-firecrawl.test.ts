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
})
