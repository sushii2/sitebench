import { resolveBrandWebsitePreview } from "@/lib/brands/logo"
import type { BrandCompetitor } from "@/lib/brands/types"
import { resolveLogoDevPublicConfig } from "@/lib/logo-dev/config"

const MAX_VISIBLE = 3

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  )
}

export function TopPerformersCell({
  competitors,
  count,
}: {
  competitors: BrandCompetitor[]
  count: number
}) {
  if (competitors.length === 0) {
    return <span className="text-xs text-muted-foreground">--</span>
  }

  let publishableKey: string | null = null

  try {
    publishableKey = resolveLogoDevPublicConfig().publishableKey
  } catch {
    publishableKey = null
  }

  const visible = competitors.slice(0, MAX_VISIBLE)
  const overflow = Math.max(0, count - visible.length)

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visible.map((competitor) => {
          const preview = publishableKey
            ? resolveBrandWebsitePreview(competitor.website, publishableKey)
            : null

          return (
            <span
              key={competitor.id}
              title={competitor.name}
              className="flex size-6 items-center justify-center overflow-hidden border border-background bg-muted text-[10px] font-medium uppercase text-muted-foreground"
            >
              {preview ? (
                <img
                  src={preview.logoUrl}
                  alt={competitor.name}
                  width={24}
                  height={24}
                  className="size-full object-contain"
                />
              ) : (
                getInitials(competitor.name)
              )}
            </span>
          )
        })}
      </div>
      {overflow > 0 ? (
        <span className="ml-2 text-xs text-muted-foreground">+{overflow}</span>
      ) : null}
    </div>
  )
}
