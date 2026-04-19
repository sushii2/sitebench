import { parsePublicWebsiteUrl } from "@/lib/brands"
import type {
  OnboardingHomepageClassification,
  onboardingMappedCandidateBucketValues,
  onboardingPageRoleValues,
  onboardingSiteArchetypeValues,
} from "@/lib/onboarding/types"

type SiteArchetype = (typeof onboardingSiteArchetypeValues)[number]
type CandidateBucket = (typeof onboardingMappedCandidateBucketValues)[number]
type PageRole = (typeof onboardingPageRoleValues)[number]

const ECOMMERCE_TAXONOMY_TERMS = new Set([
  "accessories",
  "bags",
  "best-sellers",
  "bestsellers",
  "boots",
  "kids",
  "men",
  "new-arrivals",
  "new",
  "sale",
  "shoes",
  "women",
])

export interface MappedPageCandidate {
  description?: string | null
  title?: string | null
  url: string
}

export interface ClassifiedMappedPage extends MappedPageCandidate {
  candidateBucket: CandidateBucket
  candidateReason: string
  candidateScore: number
  included: boolean
  pageRole: PageRole
  pageType: PageRole
  selectionReason: string
  selectionScore: number
}

function normalizePageUrl(value: string) {
  const url = parsePublicWebsiteUrl(value)

  if (!url) {
    throw new Error("Enter a valid website")
  }

  url.hash = ""

  const normalized = url.toString()

  return normalized.endsWith("/") && url.pathname === "/"
    ? normalized.slice(0, -1)
    : normalized
}

function normalizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ""
}

function getPathname(url: string) {
  try {
    return new URL(normalizePageUrl(url)).pathname.toLowerCase()
  } catch {
    return "/"
  }
}

function isSameUrl(left: string, right: string) {
  try {
    return normalizePageUrl(left) === normalizePageUrl(right)
  } catch {
    return left === right
  }
}

function toClassifiedPage(
  page: MappedPageCandidate,
  partial: Omit<
    ClassifiedMappedPage,
    | "description"
    | "selectionReason"
    | "selectionScore"
    | "title"
    | "url"
    | "pageType"
  >
) {
  const url = normalizePageUrl(page.url)

  return {
    ...page,
    candidateBucket: partial.candidateBucket,
    candidateReason: partial.candidateReason,
    candidateScore: partial.candidateScore,
    included: partial.included,
    pageRole: partial.pageRole,
    pageType: partial.pageRole,
    selectionReason: partial.candidateReason,
    selectionScore: partial.candidateScore,
    title: page.title ?? null,
    url,
  }
}

function inferSiteArchetype(
  siteArchetype?: SiteArchetype,
  classification?: Pick<OnboardingHomepageClassification, "siteArchetype">
) {
  return classification?.siteArchetype ?? siteArchetype ?? "saas"
}

function classifyEcommercePage(
  page: MappedPageCandidate,
  pathname: string,
  haystack: string
) {
  const segments = pathname.split("/").filter(Boolean)
  const firstSegment = segments[0] ?? ""

  if (
    firstSegment === "products" ||
    firstSegment === "product" ||
    firstSegment === "item"
  ) {
    return toClassifiedPage(page, {
      candidateBucket: "product_detail",
      candidateReason: "Specific SKU or product detail page",
      candidateScore: 350,
      included: true,
      pageRole: "other",
    })
  }

  if (
    segments.length <= 2 &&
    (ECOMMERCE_TAXONOMY_TERMS.has(firstSegment) ||
      /\/(collections?|category|categories|shop|store|department|c)\b/.test(
        pathname
      ) ||
      /\b(collection|category|shop|store|department|sale|new arrivals?|best sellers?)\b/.test(
        haystack
      ))
  ) {
    return toClassifiedPage(page, {
      candidateBucket: "category_hub",
      candidateReason: "Commercial category or collection hub page",
      candidateScore: firstSegment === "sale" ? 900 : 910,
      included: true,
      pageRole: "category_hub",
    })
  }

  if (/\b(size guide|fit guide|gift guide|bundles?)\b/.test(haystack)) {
    return toClassifiedPage(page, {
      candidateBucket: "category_hub",
      candidateReason: "Buyer-guidance merchandising page",
      candidateScore: 840,
      included: true,
      pageRole: "category_hub",
    })
  }

  return toClassifiedPage(page, {
    candidateBucket: "product_hub",
    candidateReason: "General ecommerce commercial page",
    candidateScore: 760,
    included: true,
    pageRole: "product_hub",
  })
}

function classifySaasLikePage(
  page: MappedPageCandidate,
  pathname: string,
  haystack: string
) {
  if (/\b(integrations?|connectors?)\b/.test(haystack)) {
    return toClassifiedPage(page, {
      candidateBucket: "integration_page",
      candidateReason: "Integration or ecosystem page",
      candidateScore: 860,
      included: true,
      pageRole: "integration_page",
    })
  }

  if (/\b(platform|product|products|features?|capabilities)\b/.test(haystack)) {
    return toClassifiedPage(page, {
      candidateBucket: "product_hub",
      candidateReason: "Product or platform overview page",
      candidateScore: 920,
      included: true,
      pageRole: "product_hub",
    })
  }

  if (/\b(solutions?|industries?|use-cases?|teams?|roles?)\b/.test(haystack)) {
    return toClassifiedPage(page, {
      candidateBucket: "solution_page",
      candidateReason: "Solution or audience-specific page",
      candidateScore: pathname.split("/").filter(Boolean).length > 1 ? 905 : 890,
      included: true,
      pageRole: "solution_page",
    })
  }

  if (/\b(docs?|developers?|security|compliance)\b/.test(haystack)) {
    return toClassifiedPage(page, {
      candidateBucket: "integration_page",
      candidateReason: "Technical trust-building page",
      candidateScore: 780,
      included: true,
      pageRole: "integration_page",
    })
  }

  return toClassifiedPage(page, {
    candidateBucket: "product_hub",
    candidateReason: "General commercial or product context page",
    candidateScore: 760,
    included: true,
    pageRole: "product_hub",
  })
}

export function classifyMappedPage(
  page: MappedPageCandidate,
  options?: {
    classification?: Pick<OnboardingHomepageClassification, "siteArchetype">
    rootUrl?: string
    siteArchetype?: SiteArchetype
  }
): ClassifiedMappedPage {
  const url = normalizePageUrl(page.url)
  const pathname = getPathname(url)
  const title = normalizeText(page.title)
  const description = normalizeText(page.description)
  const haystack = `${pathname} ${title} ${description}`
  const siteArchetype = inferSiteArchetype(
    options?.siteArchetype,
    options?.classification
  )
  const isHomepage =
    pathname === "/" || (options?.rootUrl ? isSameUrl(url, options.rootUrl) : false)

  if (isHomepage) {
    return toClassifiedPage(page, {
      candidateBucket: "homepage",
      candidateReason: "Homepage anchor page",
      candidateScore: 1000,
      included: true,
      pageRole: "homepage",
    })
  }

  if (
    /\b(login|signin|sign-in|privacy|terms|legal|status|support|help|account|wishlist|returns?|track-order|checkout|cart)\b/.test(
      haystack
    )
  ) {
    return toClassifiedPage(page, {
      candidateBucket: "utility",
      candidateReason: "Utility page with low commercial value for onboarding",
      candidateScore: 0,
      included: false,
      pageRole: "other",
    })
  }

  if (/\b(pricing|plans?|quote|demo)\b/.test(haystack)) {
    return toClassifiedPage(page, {
      candidateBucket: "pricing",
      candidateReason: "Pricing or commercial conversion page",
      candidateScore: 960,
      included: true,
      pageRole: "pricing",
    })
  }

  if (/\b(compare|comparison|alternatives?|versus|vs)\b/.test(haystack)) {
    return toClassifiedPage(page, {
      candidateBucket: "comparison_page",
      candidateReason: "Comparison or alternatives page",
      candidateScore: 940,
      included: true,
      pageRole: "comparison_page",
    })
  }

  if (/\b(customer|customers|case study|case studies|testimonials?)\b/.test(haystack)) {
    return toClassifiedPage(page, {
      candidateBucket: "proof_page",
      candidateReason: "Customer proof page",
      candidateScore: 820,
      included: true,
      pageRole: "proof_page",
    })
  }

  if (/\b(careers?|jobs?|hiring)\b/.test(haystack)) {
    return toClassifiedPage(page, {
      candidateBucket: "careers",
      candidateReason: "Careers page with company and geography signals",
      candidateScore: 620,
      included: true,
      pageRole: "careers_page",
    })
  }

  if (/\b(about|company|mission|story|team)\b/.test(haystack)) {
    return toClassifiedPage(page, {
      candidateBucket: "about",
      candidateReason: "About page with company context",
      candidateScore: 640,
      included: true,
      pageRole: "other",
    })
  }

  if (/\b(blog|guides?|resources?|journal|news|insights?)\b/.test(haystack)) {
    return toClassifiedPage(page, {
      candidateBucket: "editorial",
      candidateReason: "Editorial or educational page",
      candidateScore: 680,
      included: true,
      pageRole: "editorial_page",
    })
  }

  if (siteArchetype === "ecommerce") {
    return classifyEcommercePage(page, pathname, haystack)
  }

  return classifySaasLikePage(page, pathname, haystack)
}

export function mergeMappedPages(pageGroups: MappedPageCandidate[][]) {
  const deduped: MappedPageCandidate[] = []

  for (const page of pageGroups.flat()) {
    const normalizedUrl = normalizePageUrl(page.url)

    if (!deduped.some((candidate) => isSameUrl(candidate.url, normalizedUrl))) {
      deduped.push({
        description: page.description ?? null,
        title: page.title ?? null,
        url: normalizedUrl,
      })
    }
  }

  return deduped
}

export function prefilterMappedPages(
  pages: MappedPageCandidate[],
  options?: {
    classification?: Pick<OnboardingHomepageClassification, "siteArchetype">
    homepageUrl?: string
    limit?: number
    siteArchetype?: SiteArchetype
  }
) {
  const classified = pages
    .map((page) =>
      classifyMappedPage(page, {
        classification: options?.classification,
        rootUrl: options?.homepageUrl,
        siteArchetype: options?.siteArchetype,
      })
    )
    .filter((page) => page.included)
    .sort((left, right) => right.candidateScore - left.candidateScore)

  const deduped = classified.filter(
    (page, index, current) =>
      current.findIndex((candidate) => candidate.url === page.url) === index
  )

  return deduped.slice(0, options?.limit ?? 120)
}

export function selectPagesForCrawl(
  pages: MappedPageCandidate[],
  options?: {
    classification?: Pick<OnboardingHomepageClassification, "siteArchetype">
    maxPages?: number
    rootUrl?: string
    siteArchetype?: SiteArchetype
  }
) {
  return prefilterMappedPages(pages, {
    classification: options?.classification,
    homepageUrl: options?.rootUrl,
    limit: options?.maxPages ?? 10,
    siteArchetype: options?.siteArchetype,
  })
}
