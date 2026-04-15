"use client"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { TopQuery } from "@/lib/dashboard/mock-data"

export function TopQueries({ queries }: { queries: TopQuery[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Top Queries</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        {queries.map((item, index) => {
          const rate = Math.round((item.mentions / item.total) * 100)

          return (
            <div key={item.query}>
              {index > 0 && <Separator />}
              <div className="space-y-1.5 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm leading-snug">{item.query}</p>
                  <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                    {item.mentions}/{item.total}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative h-1 w-16 shrink-0 overflow-hidden rounded-none bg-muted">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {item.platforms.map((platform) => (
                      <Badge
                        key={platform}
                        variant="secondary"
                        className="px-1.5 py-0 text-[10px]"
                      >
                        {platform}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
