import { parsePublicWebsiteUrl } from "@/lib/brands"
import type { SiteCrawlPageType } from "@/lib/site-crawl-pages/types"

export interface MappedPageCandidate {
  description?: string | null
  title?: string | null
  url: string
}

export interface ClassifiedMappedPage extends MappedPageCandidate {
  included: boolean
  pageType: SiteCrawlPageType
  selectionReason: string
  selectionScore: number
}

function normalizePageUrl(value: string) {
  const url = parsePublicWebsiteUrl(value)

  if (!url) {
    throw new Error("Enter a valid website")
  }

  url.hash = ""

  return url.toString()
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ""
}

function isSameUrl(left: string, right: string) {
  try {
    return normalizePageUrl(left) === normalizePageUrl(right)
  } catch {
    return left === right
  }
}

function getPathname(url: string) {
  try {
    return new URL(normalizePageUrl(url)).pathname.toLowerCase()
  } catch {
    return "/"
  }
}

function scorePageType(pageType: SiteCrawlPageType) {
  switch (pageType) {
    case "homepage":
      return 100
    case "pricing":
      return 92
    case "comparison":
      return 88
    case "product":
      return 84
    case "blog":
      return 76
    case "excluded":
      return 0
  }
}

function classifyProductContext(
  pathname: string,
  haystack: string
): Pick<ClassifiedMappedPage, "pageType" | "selectionReason" | "selectionScore"> {
  const segments = pathname.split("/").filter(Boolean)
  const firstSegment = segments[0] ?? ""
  const isCatalogHub =
    /\b(shop|store|catalog|collection|collections|category|categories|menu)\b/.test(
      haystack
    ) && segments.length <= 2
  const isProductDetail =
    ["product", "products", "item", "items", "shop", "store", "catalog"].includes(
      firstSegment
    ) && segments.length >= 2
  const isSolutionsPage =
    /\b(platform|features?|solutions?|industries?|integrations?|services?)\b/.test(
      haystack
    )

  if (isCatalogHub) {
    return {
      pageType: "product",
      selectionReason: "Catalog or collection hub page",
      selectionScore: scorePageType("product") + 4,
    }
  }

  if (isProductDetail) {
    return {
      pageType: "product",
      selectionReason: "Specific product or item detail page",
      selectionScore: scorePageType("product") - 4,
    }
  }

  if (isSolutionsPage) {
    return {
      pageType: "product",
      selectionReason: "Product, feature, or solution page",
      selectionScore: scorePageType("product"),
    }
  }

  return {
    pageType: "product",
    selectionReason: "General product, commercial, or category page",
    selectionScore: scorePageType("product") - 8,
  }
}

export function classifyMappedPage(
  page: MappedPageCandidate,
  rootUrl?: string
): ClassifiedMappedPage {
  const url = normalizePageUrl(page.url)
  const pathname = getPathname(url)
  const title = normalizeText(page.title)
  const description = normalizeText(page.description)
  const haystack = `${pathname} ${title} ${description}`
  const isHomepage =
    pathname === "/" || (rootUrl ? isSameUrl(url, rootUrl) : false)

  if (
    /\b(docs?|api|help|support|login|signin|sign-in|privacy|terms|legal|status|careers?|cart|checkout|account|wishlist|returns?|track-order)\b/.test(
      haystack
    )
  ) {
    return {
      ...page,
      included: false,
      pageType: "excluded",
      selectionReason: "Excluded low-signal utility page",
      selectionScore: 0,
      url,
    }
  }

  if (isHomepage) {
    return {
      ...page,
      included: true,
      pageType: "homepage",
      selectionReason: "Homepage anchor page",
      selectionScore: scorePageType("homepage"),
      url,
    }
  }

  if (/\b(pricing|plans?)\b/.test(haystack)) {
    return {
      ...page,
      included: true,
      pageType: "pricing",
      selectionReason: "Pricing intent page",
      selectionScore: scorePageType("pricing"),
      url,
    }
  }

  if (/\b(compare|comparison|alternatives?|versus|vs)\b/.test(haystack)) {
    return {
      ...page,
      included: true,
      pageType: "comparison",
      selectionReason: "Comparison intent page",
      selectionScore: scorePageType("comparison"),
      url,
    }
  }

  if (/\b(blog|resource|learn|guide|article|journal|stories|news|insights?)\b/.test(haystack)) {
    return {
      ...page,
      included: true,
      pageType: "blog",
      selectionReason: "High-signal editorial page",
      selectionScore: scorePageType("blog"),
      url,
    }
  }

  const productContext = classifyProductContext(pathname, haystack)

  return {
    ...page,
    included: true,
    pageType: productContext.pageType,
    selectionReason: productContext.selectionReason,
    selectionScore: productContext.selectionScore,
    url,
  }
}

export function mergeMappedPages(pageGroups: MappedPageCandidate[][]) {
  const deduped: MappedPageCandidate[] = []

  for (const page of pageGroups.flat()) {
    if (!deduped.some((candidate) => isSameUrl(candidate.url, page.url))) {
      deduped.push({
        description: page.description ?? null,
        title: page.title ?? null,
        url: normalizePageUrl(page.url),
      })
    }
  }

  return deduped
}

function takeQuotaPages(
  pages: ClassifiedMappedPage[],
  pageType: SiteCrawlPageType,
  limit: number
) {
  return pages
    .filter((page) => page.pageType === pageType && page.included)
    .sort((left, right) => right.selectionScore - left.selectionScore)
    .slice(0, limit)
}

function uniqueByUrl(pages: ClassifiedMappedPage[]) {
  return pages.filter(
    (page, index, current) =>
      current.findIndex((candidate) => candidate.url === page.url) === index
  )
}

export function selectPagesForCrawl(
  pages: MappedPageCandidate[],
  options?: {
    maxPages?: number
    minPages?: number
    rootUrl?: string
  }
) {
  const maxPages = options?.maxPages ?? 10
  const minPages = options?.minPages ?? 6
  const classified = pages
    .map((page) => classifyMappedPage(page, options?.rootUrl))
    .filter((page) => page.included)

  const selected = uniqueByUrl([
    ...takeQuotaPages(classified, "homepage", 1),
    ...takeQuotaPages(classified, "product", 3),
    ...takeQuotaPages(classified, "pricing", 1),
    ...takeQuotaPages(classified, "comparison", 2),
    ...takeQuotaPages(classified, "blog", 3),
  ])

  if (selected.length < minPages) {
    const overflow = classified
      .filter((page) => !selected.some((candidate) => candidate.url === page.url))
      .sort((left, right) => right.selectionScore - left.selectionScore)

    for (const page of overflow) {
      selected.push(page)

      if (selected.length >= minPages) {
        break
      }
    }
  }

  return selected.slice(0, maxPages)
}
