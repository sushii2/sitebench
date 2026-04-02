"use client"

import { resolveBrandWebsitePreview } from "@/lib/brands"
import { resolveLogoDevPublicConfig } from "@/lib/logo-dev/config"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

type BrandPreviewProps = {
  className?: string
  name?: string
  website: string
}

function getFallbackLabel(value: string) {
  const normalized = value.trim()

  if (!normalized) {
    return "?"
  }

  return normalized.slice(0, 1).toUpperCase()
}

export function BrandPreview({
  className,
  name,
  website,
}: BrandPreviewProps) {
  let publishableKey: string

  try {
    publishableKey = resolveLogoDevPublicConfig().publishableKey
  } catch {
    return null
  }

  const preview = resolveBrandWebsitePreview(website, publishableKey)

  if (!preview) {
    return null
  }

  const fallbackLabel = getFallbackLabel(name || preview.domain)

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-none border bg-muted/30 px-3 py-2",
        className
      )}
    >
      <Avatar size="sm" className="rounded-none">
        <AvatarImage
          className="rounded-none object-contain"
          src={preview.logoUrl}
          alt={`${name?.trim() || preview.domain} logo`}
        />
        <AvatarFallback className="rounded-none text-[10px] font-medium uppercase">
          {fallbackLabel}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        {name?.trim() ? (
          <div className="truncate text-sm font-medium">{name.trim()}</div>
        ) : null}
        <div className="truncate text-xs text-muted-foreground">
          {preview.origin}
        </div>
      </div>
    </div>
  )
}
