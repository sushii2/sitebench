"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ChatBrandMention } from "@/lib/chats/types"

function formatScore(score: number | null): string {
  if (score === null) {
    return "—"
  }

  return score.toFixed(1)
}

function formatRank(rank: number | null): string {
  if (rank === null) {
    return "—"
  }

  return `#${rank}`
}

function sortMentions(mentions: ChatBrandMention[]): ChatBrandMention[] {
  return [...mentions].sort((a, b) => {
    if (a.brand.role !== b.brand.role) {
      return a.brand.role === "primary" ? -1 : 1
    }

    const aRank = a.metric.rank_position ?? Number.MAX_SAFE_INTEGER
    const bRank = b.metric.rank_position ?? Number.MAX_SAFE_INTEGER

    return aRank - bRank
  })
}

export function ChatBrandsPanel({
  mentions,
}: {
  mentions: ChatBrandMention[]
}) {
  const sorted = sortMentions(mentions)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Brands</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {sorted.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No brand mentions detected.
          </p>
        ) : (
          sorted.map(({ brand, metric }) => (
            <div
              key={brand.id}
              className="flex flex-col gap-1 rounded-md border border-border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {brand.name}
                </span>
                {brand.role === "primary" ? (
                  <Badge variant="default" className="text-[10px]">
                    Primary
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>Rank {formatRank(metric.rank_position)}</span>
                <span>Vis {formatScore(metric.visibility_score)}</span>
                <span>Cit {formatScore(metric.citation_score)}</span>
                <span>Sent {metric.sentiment_label}</span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
