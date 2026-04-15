"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { SentimentData } from "@/lib/dashboard/mock-data"

const sentimentColors: Record<string, string> = {
  Positive: "var(--chart-1)",
  Neutral: "var(--muted-foreground)",
  Negative: "var(--destructive)",
}

export function SentimentOverview({ data }: { data: SentimentData[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Sentiment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.map((item) => (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium tabular-nums">{item.value}%</span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-none bg-muted">
              <div
                className="h-full transition-all"
                style={{
                  width: `${item.value}%`,
                  backgroundColor: sentimentColors[item.label] ?? "var(--primary)",
                }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
