"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import type { WeeklyAlert } from "@/lib/dashboard/mock-data"
import { cn } from "@/lib/utils"

const alertIndicator: Record<string, string> = {
  gain: "bg-emerald-500",
  loss: "bg-destructive",
  new: "bg-chart-2",
  opportunity: "bg-chart-3",
}

const alertLabel: Record<string, string> = {
  gain: "Gain",
  loss: "Loss",
  new: "New",
  opportunity: "Opportunity",
}

export function WeeklyAlerts({ alerts }: { alerts: WeeklyAlert[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Weekly Alerts</CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        {alerts.map((alert, index) => (
          <div key={index}>
            {index > 0 && <Separator />}
            <div className="flex gap-3 py-2.5">
              <div className="flex flex-col items-center gap-1 pt-0.5">
                <div
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    alertIndicator[alert.type] ?? "bg-muted-foreground"
                  )}
                />
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{alert.title}</p>
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    {alertLabel[alert.type]}
                  </span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {alert.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
