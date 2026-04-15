"use client"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { ContentGap } from "@/lib/dashboard/mock-data"

const volumeVariant: Record<string, "default" | "secondary" | "outline"> = {
  High: "default",
  Medium: "secondary",
  Low: "outline",
}

export function ContentGaps({ gaps }: { gaps: ContentGap[] }) {
  const highPriorityCount = gaps.filter((g) => g.estimatedVolume === "High" && g.yourVisibility === 0).length

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm font-medium">Content Gaps</CardTitle>
            <CardDescription className="text-xs">
              Queries where competitors appear but you don&apos;t
            </CardDescription>
          </div>
          {highPriorityCount > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {highPriorityCount} high priority
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-0">
        {gaps.map((gap, index) => (
          <div key={gap.query}>
            {index > 0 && <Separator />}
            <div className="space-y-1.5 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm leading-snug">&ldquo;{gap.query}&rdquo;</p>
                <Badge
                  variant={volumeVariant[gap.estimatedVolume] ?? "outline"}
                  className="shrink-0 text-[10px]"
                >
                  {gap.estimatedVolume}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>
                  Your visibility:{" "}
                  <span className={gap.yourVisibility === 0 ? "font-medium text-destructive" : "font-medium"}>
                    {gap.yourVisibility}%
                  </span>
                </span>
                <span>&middot;</span>
                <span>
                  Competitors: {gap.competitorsMentioned.join(", ")}
                </span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
