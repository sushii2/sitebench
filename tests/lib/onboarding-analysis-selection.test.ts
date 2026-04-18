import { describe, expect, it } from "vitest"

import {
  classifyMappedPage,
  mergeMappedPages,
  selectPagesForCrawl,
} from "@/lib/onboarding/analysis-selection"

describe("onboarding analysis page selection", () => {
  it("classifies high-signal marketing pages and excludes low-signal support pages", () => {
    expect(
      classifyMappedPage({
        description: "Compare Acme with other AI visibility platforms.",
        title: "Acme Alternatives",
        url: "https://acme.com/alternatives",
      })
    ).toMatchObject({
      included: true,
      pageType: "comparison",
    })

    expect(
      classifyMappedPage({
        description: "API reference",
        title: "Developer Docs",
        url: "https://acme.com/docs/api",
      })
    ).toMatchObject({
      included: false,
      pageType: "excluded",
    })

    expect(
      classifyMappedPage({
        description: "Browse the latest arrivals and best sellers.",
        title: "Shop",
        url: "https://acme.com/shop",
      })
    ).toMatchObject({
      included: true,
      pageType: "product",
      selectionReason: "Catalog or collection hub page",
    })

    expect(
      classifyMappedPage({
        description: "Your basket",
        title: "Cart",
        url: "https://acme.com/cart",
      })
    ).toMatchObject({
      included: false,
      pageType: "excluded",
    })
  })

  it("prioritizes ecommerce collection hubs above individual product detail pages", () => {
    const collection = classifyMappedPage({
      description: "Shop all running shoes",
      title: "Running Shoes Collection",
      url: "https://acme.com/collections/running-shoes",
    })
    const productDetail = classifyMappedPage({
      description: "Carbon running shoe",
      title: "Velocity Carbon",
      url: "https://acme.com/products/velocity-carbon",
    })

    expect(collection.pageType).toBe("product")
    expect(productDetail.pageType).toBe("product")
    expect(collection.selectionScore).toBeGreaterThan(productDetail.selectionScore)
  })

  it("dedupes mapped pages by canonical url", () => {
    const result = mergeMappedPages([
      [
        {
          description: "Pricing overview",
          title: "Pricing",
          url: "https://acme.com/pricing",
        },
      ],
      [
        {
          description: "Pricing overview duplicate",
          title: "Pricing",
          url: "https://acme.com/pricing",
        },
      ],
    ])

    expect(result).toHaveLength(1)
    expect(result[0]?.url).toBe("https://acme.com/pricing")
  })

  it("selects crawl pages with quotas across homepage, product, pricing, comparison, and blog", () => {
    const result = selectPagesForCrawl(
      [
        {
          description: "Homepage",
          title: "Acme",
          url: "https://acme.com",
        },
        {
          description: "Feature page",
          title: "Platform",
          url: "https://acme.com/platform",
        },
        {
          description: "Solutions page",
          title: "Solutions",
          url: "https://acme.com/solutions",
        },
        {
          description: "Pricing page",
          title: "Pricing",
          url: "https://acme.com/pricing",
        },
        {
          description: "Competitor comparison",
          title: "Acme vs Profound",
          url: "https://acme.com/compare/profound",
        },
        {
          description: "Alternative page",
          title: "Acme alternatives",
          url: "https://acme.com/alternatives",
        },
        {
          description: "Blog article",
          title: "How to measure AI visibility",
          url: "https://acme.com/blog/measure-ai-visibility",
        },
        {
          description: "Resource article",
          title: "What is answer engine optimization?",
          url: "https://acme.com/blog/answer-engine-optimization",
        },
      ],
      {
        maxPages: 10,
        minPages: 6,
      }
    )

    expect(result.map((page) => page.pageType)).toEqual([
      "homepage",
      "product",
      "product",
      "pricing",
      "comparison",
      "comparison",
      "blog",
      "blog",
    ])
  })
})
