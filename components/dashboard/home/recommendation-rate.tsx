"use client"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { RecommendationRateData } from "@/lib/dashboard/mock-data"

export function RecommendationRate({ data }: { data: RecommendationRateData }) {
  const overallRate = Math.round((data.recommended / data.mentioned) * 100)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm font-medium">
              Recommendation Rate
            </CardTitle>
            <CardDescription className="text-xs">
              How often your brand is recommended, not just mentioned
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tracking-tight text-primary">
              {overallRate}%
            </p>
            <p className="text-xs text-muted-foreground">Overall Rate</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-none bg-muted/50 px-3 py-2 text-xs">
          <span className="text-muted-foreground">
            Mentioned <span className="font-medium text-foreground">{data.mentioned}</span> times
          </span>
          <span className="text-muted-foreground">
            Recommended <span className="font-medium text-foreground">{data.recommended}</span> times
          </span>
        </div>

        <div className="space-y-2.5">
          {data.byProvider.map((item) => (
            <div key={item.platform} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">{item.platform}</span>
                <span className="font-medium tabular-nums">{item.rate}%</span>
              </div>
              <div className="relative h-1.5 w-full overflow-hidden rounded-none bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${item.rate}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-none border border-dashed px-3 py-2 text-xs">
          <p className="text-muted-foreground">Top recommended query</p>
          <p className="mt-0.5 font-medium">&ldquo;{data.topRecommendedQuery}&rdquo;</p>
        </div>
      </CardContent>
    </Card>
  )
}
