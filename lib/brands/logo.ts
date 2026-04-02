import { parsePublicWebsiteUrl } from "@/lib/brands/validation"

export type BrandWebsitePreview = {
  domain: string
  logoUrl: string
  origin: string
}

const DEFAULT_LOGO_FORMAT = "png"
const DEFAULT_LOGO_SIZE = "64"
const DEFAULT_LOGO_FALLBACK = "monogram"

export function buildBrandLogoUrl(domain: string, publishableKey: string) {
  const url = new URL(`https://img.logo.dev/${domain}`)

  url.searchParams.set("token", publishableKey)
  url.searchParams.set("size", DEFAULT_LOGO_SIZE)
  url.searchParams.set("format", DEFAULT_LOGO_FORMAT)
  url.searchParams.set("fallback", DEFAULT_LOGO_FALLBACK)

  return url.toString()
}

export function resolveBrandWebsitePreview(
  input: string,
  publishableKey: string
): BrandWebsitePreview | null {
  const url = parsePublicWebsiteUrl(input)

  if (!url) {
    return null
  }

  const domain = url.hostname.toLowerCase()

  return {
    domain,
    logoUrl: buildBrandLogoUrl(domain, publishableKey),
    origin: url.origin,
  }
}
