const WEBSITE_ERROR = "Enter a valid website"
const COMPANY_NAME_ERROR = "Enter a valid company name"
const WEBSITE_PROTOCOL_PATTERN = /^[a-z][a-z\d+\-.]*:\/\//i
const IPV4_PATTERN =
  /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/

function normalizeWhitespace(value: string) {
  return value.trim().replace(/\s+/g, " ")
}

function toPublicHttpUrl(value: string) {
  const trimmed = value.trim()

  if (!trimmed) {
    return null
  }

  const withProtocol = WEBSITE_PROTOCOL_PATTERN.test(trimmed)
    ? trimmed
    : `https://${trimmed}`

  try {
    const url = new URL(withProtocol)

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null
    }

    const hostname = url.hostname.toLowerCase()

    if (
      hostname === "localhost" ||
      !hostname.includes(".") ||
      hostname.startsWith("[") ||
      hostname.endsWith(".") ||
      IPV4_PATTERN.test(hostname)
    ) {
      return null
    }

    const labels = hostname.split(".")

    if (
      labels.length < 2 ||
      labels.some(
        (label) =>
          !label ||
          label.startsWith("-") ||
          label.endsWith("-") ||
          !/^[a-z0-9-]+$/i.test(label)
      ) ||
      labels.at(-1)!.length < 2
    ) {
      return null
    }

    return url
  } catch {
    return null
  }
}

export function parsePublicWebsiteUrl(value: string) {
  return toPublicHttpUrl(value)
}

export function getWebsiteValidationError(value: string) {
  return toPublicHttpUrl(value) ? null : WEBSITE_ERROR
}

export function normalizeWebsite(value: string) {
  const url = toPublicHttpUrl(value)

  if (!url) {
    throw new Error(WEBSITE_ERROR)
  }

  return url.origin
}

export function getCompanyNameValidationError(value: string) {
  const normalized = normalizeWhitespace(value)

  if (!normalized || normalized.length < 2 || normalized.length > 100) {
    return COMPANY_NAME_ERROR
  }

  if (!normalized.includes(" ") && !getWebsiteValidationError(normalized)) {
    return COMPANY_NAME_ERROR
  }

  return null
}

export function normalizeCompanyName(value: string) {
  const normalized = normalizeWhitespace(value)
  const error = getCompanyNameValidationError(normalized)

  if (error) {
    throw new Error(error)
  }

  return normalized
}
