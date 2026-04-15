"use client"

import { ArrowUp01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { PlatformBreakdown as PlatformBreakdownType } from "@/lib/dashboard/mock-data"

const platformColors: Record<string, string> = {
  ChatGPT: "var(--chart-1)",
  Claude: "var(--chart-2)",
  Gemini: "var(--chart-3)",
  Grok: "var(--chart-4)",
}

export function PlatformBreakdown({
  platforms,
}: {
  platforms: PlatformBreakdownType[]
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Platform Breakdown
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {platforms.map((item) => (
          <div key={item.platform} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{item.platform}</span>
              <div className="flex items-center gap-1">
                <span className="font-medium tabular-nums">
                  {item.visibility}%
                </span>
                {item.change > 0 ? (
                  <span className="flex items-center gap-0.5 text-emerald-600 dark:text-emerald-400">
                    <HugeiconsIcon
                      icon={ArrowUp01Icon}
                      strokeWidth={2}
                      className="size-3"
                    />
                    +{item.change}
                  </span>
                ) : item.change < 0 ? (
                  <span className="flex items-center gap-0.5 text-destructive">
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      strokeWidth={2}
                      className="size-3"
                    />
                    {item.change}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-none bg-muted">
              <div
                className="h-full transition-all"
                style={{
                  width: `${item.visibility}%`,
                  backgroundColor:
                    platformColors[item.platform] ?? "var(--primary)",
                }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
