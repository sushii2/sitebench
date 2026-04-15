"use client"

import { ArrowUp01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { CategoryPosition } from "@/lib/dashboard/mock-data"

export function CategoryLeaderboard({
  categories,
}: {
  categories: CategoryPosition[]
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Category Leaderboard
        </CardTitle>
        <CardDescription className="text-xs">
          Your position within product categories
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-0">
        {categories.map((cat, index) => (
          <div key={cat.category}>
            {index > 0 && <Separator />}
            <div className="flex items-center gap-3 py-2.5">
              <div className="flex size-8 items-center justify-center bg-muted font-mono text-xs font-semibold">
                #{cat.rank}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{cat.category}</p>
                <p className="text-xs text-muted-foreground">
                  of {cat.totalCompetitors} competitors &middot; {cat.visibility}% visibility
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs">
                {cat.trend > 0 ? (
                  <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                    <HugeiconsIcon
                      icon={ArrowUp01Icon}
                      strokeWidth={2}
                      className="size-3"
                    />
                    +{cat.trend}
                  </span>
                ) : cat.trend < 0 ? (
                  <span className="flex items-center gap-0.5 text-destructive">
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      strokeWidth={2}
                      className="size-3"
                    />
                    {cat.trend}
                  </span>
                ) : (
                  <span className="text-muted-foreground">--</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
