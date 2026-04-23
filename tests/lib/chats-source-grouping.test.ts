import { describe, expect, it } from "vitest"

import { groupSources } from "@/lib/chats/source-grouping"
import type { BrandEntity } from "@/lib/brand-entities/types"
import type { ResponseCitation } from "@/lib/response-citations/types"
import type { SourceDomain } from "@/lib/source-domains/types"
import type { SourcePage } from "@/lib/source-pages/types"

function makeBrand(
  overrides: Partial<BrandEntity> & Pick<BrandEntity, "website_host">
): BrandEntity {
  return {
    created_at: "2026-04-01T00:00:00.000Z",
    description: "",
    id: `brand-${overrides.website_host}`,
    is_active: true,
    name: overrides.website_host,
    normalized_name: overrides.website_host,
    project_id: "project-1",
    role: "competitor",
    sort_order: 0,
    updated_at: "2026-04-01T00:00:00.000Z",
    website_url: `https://${overrides.website_host}`,
    ...overrides,
  }
}

function makeCitation(
  id: string,
  domainValue: string
): {
  attributedBrandIds: string[]
  citation: ResponseCitation
  page: SourcePage
  domain: SourceDomain
} {
  return {
    attributedBrandIds: [],
    citation: {
      authority_score: null,
      cited_url: `https://${domainValue}/post`,
      citation_order: null,
      citation_text: null,
      created_at: "2026-04-01T00:00:00.000Z",
      id,
      project_id: "project-1",
      response_id: "response-1",
      source_page_id: `page-${id}`,
    },
    page: {
      canonical_url: `https://${domainValue}/post`,
      domain_id: `domain-${domainValue}`,
      first_seen_at: "2026-04-01T00:00:00.000Z",
      id: `page-${id}`,
      page_title: null,
    },
    domain: {
      created_at: "2026-04-01T00:00:00.000Z",
      display_name: null,
      domain: domainValue,
      id: `domain-${domainValue}`,
      root_domain: domainValue,
    },
  }
}

describe("groupSources", () => {
  const primary = makeBrand({ website_host: "vercel.com", role: "primary" })
  const competitor = makeBrand({
    website_host: "netlify.com",
    role: "competitor",
  })

  it("puts exact-host matches into cited", () => {
    const result = groupSources([makeCitation("c1", "vercel.com")], [primary])

    expect(result.cited).toHaveLength(1)
    expect(result.notCited).toHaveLength(0)
    expect(result.cited[0].matchedBrand?.id).toBe(primary.id)
  })

  it("matches subdomains of brand host", () => {
    const result = groupSources([makeCitation("c1", "docs.vercel.com")], [primary])

    expect(result.cited).toHaveLength(1)
    expect(result.cited[0].matchedBrand?.id).toBe(primary.id)
  })

  it("ignores www. prefix on the domain", () => {
    const result = groupSources([makeCitation("c1", "www.vercel.com")], [primary])

    expect(result.cited).toHaveLength(1)
  })

  it("is case-insensitive", () => {
    const result = groupSources([makeCitation("c1", "VERCEL.com")], [primary])

    expect(result.cited).toHaveLength(1)
  })

  it("puts non-matching domains into notCited", () => {
    const result = groupSources(
      [makeCitation("c1", "github.com"), makeCitation("c2", "reddit.com")],
      [primary]
    )

    expect(result.cited).toHaveLength(0)
    expect(result.notCited).toHaveLength(2)
    expect(result.notCited[0].matchedBrand).toBeNull()
  })

  it("matches any project brand (primary or competitor)", () => {
    const result = groupSources(
      [makeCitation("c1", "netlify.com")],
      [primary, competitor]
    )

    expect(result.cited).toHaveLength(1)
    expect(result.cited[0].matchedBrand?.id).toBe(competitor.id)
  })

  it("prefers the primary brand when multiple brands share a host prefix", () => {
    const result = groupSources(
      [makeCitation("c1", "vercel.com")],
      [competitor, primary]
    )

    expect(result.cited[0].matchedBrand?.role).toBe("primary")
  })

  it("puts everything in notCited when brands list is empty", () => {
    const result = groupSources([makeCitation("c1", "vercel.com")], [])

    expect(result.cited).toHaveLength(0)
    expect(result.notCited).toHaveLength(1)
  })

  it("treats empty domain strings as unmatched", () => {
    const result = groupSources([makeCitation("c1", "")], [primary])

    expect(result.notCited).toHaveLength(1)
  })
})
