import type { BrandEntity } from "@/lib/brand-entities/types"
import type { ResponseCitation } from "@/lib/response-citations/types"
import type { SourceDomain } from "@/lib/source-domains/types"
import type { SourcePage } from "@/lib/source-pages/types"

import type { ChatSource, ChatSourceGroup } from "@/lib/chats/types"

interface RawSource {
  attributedBrandIds: string[]
  citation: ResponseCitation
  page: SourcePage
  domain: SourceDomain
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/^www\./, "")
}

function brandsByPriority(brands: BrandEntity[]): BrandEntity[] {
  return [...brands].sort((a, b) => {
    if (a.role === b.role) {
      return 0
    }

    return a.role === "primary" ? -1 : 1
  })
}

function matchBrand(
  domainHost: string,
  brands: BrandEntity[]
): BrandEntity | null {
  if (!domainHost) {
    return null
  }

  for (const brand of brandsByPriority(brands)) {
    const brandHost = normalizeHost(brand.website_host)

    if (!brandHost) {
      continue
    }

    if (domainHost === brandHost || domainHost.endsWith(`.${brandHost}`)) {
      return brand
    }
  }

  return null
}

function matchAttributedBrand(
  attributedBrandIds: string[],
  brands: BrandEntity[]
): BrandEntity | null {
  const brandIds = new Set(attributedBrandIds)

  for (const brand of brandsByPriority(brands)) {
    if (brandIds.has(brand.id)) {
      return brand
    }
  }

  return null
}

export function groupSources(
  sources: RawSource[],
  brands: BrandEntity[]
): ChatSourceGroup {
  const cited: ChatSource[] = []
  const notCited: ChatSource[] = []

  for (const source of sources) {
    const host = normalizeHost(source.domain.domain)
    const matchedBrand =
      matchAttributedBrand(source.attributedBrandIds, brands) ??
      matchBrand(host, brands)

    const entry: ChatSource = {
      citation: source.citation,
      domain: source.domain,
      matchedBrand,
      page: source.page,
    }

    if (matchedBrand) {
      cited.push(entry)
    } else {
      notCited.push(entry)
    }
  }

  return { cited, notCited }
}
