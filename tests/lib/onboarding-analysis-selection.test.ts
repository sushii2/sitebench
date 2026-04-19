import { describe, expect, it } from "vitest"

import {
  classifyMappedPage,
  prefilterMappedPages,
} from "@/lib/onboarding/analysis-selection"

describe("onboarding analysis page selection", () => {
  it("classifies ecommerce taxonomy hubs as category hubs instead of generic product detail pages", () => {
    expect(
      classifyMappedPage(
        {
          description: "Shop the latest trail, road, and race shoes.",
          title: "Women's Running Shoes",
          url: "https://acme.com/women/shoes",
        },
        {
          rootUrl: "https://acme.com",
          siteArchetype: "ecommerce",
        }
      )
    ).toMatchObject({
      candidateBucket: "category_hub",
      included: true,
      pageRole: "category_hub",
    })

    expect(
      classifyMappedPage(
        {
          description: "Carbon-plated trail running shoe.",
          title: "Velocity X",
          url: "https://acme.com/products/velocity-x",
        },
        {
          rootUrl: "https://acme.com",
          siteArchetype: "ecommerce",
        }
      )
    ).toMatchObject({
      candidateBucket: "product_detail",
      included: true,
      pageRole: "other",
    })
  })

  it("treats SaaS platform and solution pages as product-equivalent hubs", () => {
    expect(
      classifyMappedPage(
        {
          description: "Platform overview for security teams.",
          title: "Platform",
          url: "https://acme.com/platform",
        },
        {
          rootUrl: "https://acme.com",
          siteArchetype: "saas",
        }
      )
    ).toMatchObject({
      candidateBucket: "product_hub",
      included: true,
      pageRole: "product_hub",
    })

    expect(
      classifyMappedPage(
        {
          description: "Connect Acme with your data warehouse.",
          title: "Integrations",
          url: "https://acme.com/integrations",
        },
        {
          rootUrl: "https://acme.com",
          siteArchetype: "saas",
        }
      )
    ).toMatchObject({
      candidateBucket: "integration_page",
      included: true,
      pageRole: "integration_page",
    })
  })

  it("keeps ecommerce taxonomy hubs in the prefilter while deprioritizing sku pages", () => {
    const candidates = prefilterMappedPages(
      [
        {
          description: "Homepage",
          title: "Acme",
          url: "https://acme.com",
        },
        {
          description: "Shop women's apparel",
          title: "Women",
          url: "https://acme.com/women",
        },
        {
          description: "Trail and road running shoes",
          title: "Shoes",
          url: "https://acme.com/shoes",
        },
        {
          description: "Seasonal markdowns",
          title: "Sale",
          url: "https://acme.com/sale",
        },
        {
          description: "Lightweight race-day shoe",
          title: "Velocity Carbon",
          url: "https://acme.com/products/velocity-carbon",
        },
      ],
      {
        homepageUrl: "https://acme.com",
        limit: 4,
        siteArchetype: "ecommerce",
      }
    )

    expect(candidates.map((candidate) => candidate.url)).toEqual([
      "https://acme.com",
      "https://acme.com/women",
      "https://acme.com/shoes",
      "https://acme.com/sale",
    ])
    expect(candidates.every((candidate) => candidate.candidateScore > 0)).toBe(true)
  })

  it("preserves multiple SaaS product families during prefiltering", () => {
    const candidates = prefilterMappedPages(
      [
        {
          description: "Homepage",
          title: "Acme",
          url: "https://acme.com",
        },
        {
          description: "Security platform for enterprise teams",
          title: "Platform",
          url: "https://acme.com/platform",
        },
        {
          description: "Incident response workflows for ops teams",
          title: "Solutions",
          url: "https://acme.com/solutions/incident-response",
        },
        {
          description: "Compliance automation for audit teams",
          title: "Solutions",
          url: "https://acme.com/solutions/compliance",
        },
        {
          description: "SSO and data warehouse connectors",
          title: "Integrations",
          url: "https://acme.com/integrations",
        },
      ],
      {
        homepageUrl: "https://acme.com",
        limit: 5,
        siteArchetype: "multi_product",
      }
    )

    expect(candidates.map((candidate) => candidate.url)).toEqual([
      "https://acme.com",
      "https://acme.com/platform",
      "https://acme.com/solutions/incident-response",
      "https://acme.com/solutions/compliance",
      "https://acme.com/integrations",
    ])
  })
})
