"use client"

import { useLogoDevPublishableKey } from "@/hooks/use-logo-dev-key"
import { buildBrandLogoUrl } from "@/lib/brands/logo"
import type { ChatBrandMentionSummary } from "@/lib/chats/types"
import { cn } from "@/lib/utils"

const MAX_VISIBLE = 4

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  )
}

function sortMentions(
  mentions: ChatBrandMentionSummary[]
): ChatBrandMentionSummary[] {
  return [...mentions].sort((a, b) => {
    if (a.role !== b.role) {
      return a.role === "primary" ? -1 : 1
    }

    return a.name.localeCompare(b.name)
  })
}

export function BrandIconsCell({
  mentions,
}: {
  mentions: ChatBrandMentionSummary[]
}) {
  const publishableKey = useLogoDevPublishableKey()

  if (mentions.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  const sorted = sortMentions(mentions)
  const visible = sorted.slice(0, MAX_VISIBLE)
  const overflow = Math.max(0, mentions.length - visible.length)

  return (
    <div className="flex items-center">
      <div className="flex -space-x-1.5">
        {visible.map((mention) => {
          const logoUrl =
            publishableKey && mention.websiteHost
              ? buildBrandLogoUrl(mention.websiteHost, publishableKey)
              : null

          return (
            <span
              key={mention.brandEntityId}
              title={mention.name}
              className={cn(
                "flex size-6 items-center justify-center overflow-hidden rounded-full bg-background text-[10px] font-medium uppercase text-muted-foreground ring-2",
                mention.role === "primary" ? "ring-foreground" : "ring-border"
              )}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  width={24}
                  height={24}
                  className="size-full object-contain"
                />
              ) : (
                initials(mention.name)
              )}
            </span>
          )
        })}
      </div>
      {overflow > 0 ? (
        <span className="ml-2 text-xs tabular-nums text-muted-foreground">
          +{overflow}
        </span>
      ) : null}
    </div>
  )
}
