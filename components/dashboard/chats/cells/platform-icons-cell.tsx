"use client"

import { buildPlatformLogoUrl } from "@/lib/ai-platforms/logos"
import type { ChatPlatformSummary } from "@/lib/chats/types"
import { cn } from "@/lib/utils"
import { useLogoDevPublishableKey } from "@/hooks/use-logo-dev-key"

const STATUS_RING: Record<ChatPlatformSummary["status"], string> = {
  completed: "ring-emerald-500/60",
  failed: "ring-rose-500/60",
  timeout: "ring-amber-500/60",
  blocked: "ring-rose-500/60",
  rate_limited: "ring-amber-500/60",
  missing: "ring-border",
}

const STATUS_DIM: Record<ChatPlatformSummary["status"], string> = {
  completed: "opacity-100",
  failed: "opacity-40",
  timeout: "opacity-40",
  blocked: "opacity-40",
  rate_limited: "opacity-40",
  missing: "opacity-30",
}

function initials(label: string): string {
  return (
    label
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  )
}

export function PlatformIconsCell({
  platforms,
}: {
  platforms: ChatPlatformSummary[]
}) {
  const publishableKey = useLogoDevPublishableKey()

  if (platforms.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <div className="flex -space-x-1.5">
      {platforms.map((platform) => {
        const logoUrl = buildPlatformLogoUrl(platform.code, publishableKey)
        const title = `${platform.label} · ${platform.status.replace(/_/g, " ")}`

        return (
          <span
            key={platform.code}
            title={title}
            aria-label={title}
            className={cn(
              "flex size-6 items-center justify-center overflow-hidden rounded-full bg-background text-[10px] font-medium uppercase text-muted-foreground ring-2 ring-offset-0",
              STATUS_RING[platform.status],
              STATUS_DIM[platform.status]
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
              initials(platform.label)
            )}
          </span>
        )
      })}
    </div>
  )
}
