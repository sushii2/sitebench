"use client"

import {
  BrandStatCard,
  BrandStatCardSkeleton,
} from "@/components/dashboard/chats/brand-stat-card"
import type { BrandEntity } from "@/lib/brand-entities/types"
import type { ChatBrandMention } from "@/lib/chats/types"

function sortMentions(mentions: ChatBrandMention[]): ChatBrandMention[] {
  return [...mentions].sort((a, b) => {
    if (a.brand.role !== b.brand.role) {
      return a.brand.role === "primary" ? -1 : 1
    }

    const aRank = a.metric.rank_position ?? Number.MAX_SAFE_INTEGER
    const bRank = b.metric.rank_position ?? Number.MAX_SAFE_INTEGER

    if (aRank !== bRank) {
      return aRank - bRank
    }

    return b.metric.visibility_score - a.metric.visibility_score
  })
}

export function ChatBrandsPanel({
  mentions,
  projectBrands,
}: {
  mentions: ChatBrandMention[]
  projectBrands: BrandEntity[]
}) {
  const sorted = sortMentions(mentions)
  const mentionedIds = new Set(sorted.map((m) => m.brand.id))
  const missing = projectBrands.filter(
    (brand) => brand.is_active && !mentionedIds.has(brand.id)
  )

  return (
    <aside className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Brands
        </h2>
        <span className="text-xs tabular-nums text-muted-foreground">
          {sorted.length}/{projectBrands.length}
        </span>
      </div>

      {sorted.length === 0 && missing.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
          No tracked brands.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {sorted.map((mention) => (
            <BrandStatCard key={mention.brand.id} mention={mention} />
          ))}
          {missing.length > 0 ? (
            <>
              {sorted.length > 0 ? (
                <div className="h-px bg-border" />
              ) : null}
              {missing.map((brand) => (
                <BrandStatCardSkeleton key={brand.id} brand={brand} />
              ))}
            </>
          ) : null}
        </div>
      )}
    </aside>
  )
}
