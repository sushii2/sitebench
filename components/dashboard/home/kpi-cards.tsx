"use client"

import { ArrowUp01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import {
  Card,
  CardContent,
} from "@/components/ui/card"
import type { KpiMetric } from "@/lib/dashboard/mock-data"

export function KpiCards({ metrics }: { metrics: KpiMetric[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label}>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">{metric.label}</p>
            <p className="mt-1 text-2xl font-semibold tracking-tight">
              {metric.value}
            </p>
            <div className="mt-1 flex items-center gap-1 text-xs">
              {metric.change > 0 ? (
                <>
                  <HugeiconsIcon
                    icon={ArrowUp01Icon}
                    strokeWidth={2}
                    className="size-3 text-emerald-600 dark:text-emerald-400"
                  />
                  <span className="text-emerald-600 dark:text-emerald-400">
                    +{metric.change}
                  </span>
                </>
              ) : metric.change < 0 ? (
                <>
                  <HugeiconsIcon
                    icon={ArrowDown01Icon}
                    strokeWidth={2}
                    className="size-3 text-destructive"
                  />
                  <span className="text-destructive">{metric.change}</span>
                </>
              ) : (
                <span className="text-muted-foreground">--</span>
              )}
              <span className="text-muted-foreground">{metric.changeLabel}</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
