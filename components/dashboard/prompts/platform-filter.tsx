"use client"

import * as React from "react"

import { buildBrandLogoUrl } from "@/lib/brands/logo"
import {
  PROMPT_PLATFORMS,
  type PromptPlatformId,
} from "@/lib/dashboard/prompt-platforms"
import { resolveLogoDevPublicConfig } from "@/lib/logo-dev/config"
import { cn } from "@/lib/utils"

export function PlatformFilter({
  value,
  onChange,
}: {
  value: PromptPlatformId
  onChange: (platform: PromptPlatformId) => void
}) {
  const publishableKey = React.useMemo(() => {
    try {
      return resolveLogoDevPublicConfig().publishableKey
    } catch {
      return null
    }
  }, [])

  return (
    <div
      role="tablist"
      aria-label="Filter by platform"
      className="flex w-fit items-center gap-1 border-b border-border"
    >
      {PROMPT_PLATFORMS.map((platform) => {
        const isActive = platform.id === value
        const logoUrl = publishableKey
          ? buildBrandLogoUrl(platform.domain, publishableKey)
          : null

        return (
          <button
            key={platform.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(platform.id)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                width={16}
                height={16}
                className="size-4 object-contain"
              />
            ) : null}
            <span>{platform.label}</span>
          </button>
        )
      })}
    </div>
  )
}
