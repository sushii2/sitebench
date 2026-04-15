"use client"

import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts"

import { useAuth } from "@/components/auth-provider"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  type ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import type { VisibilityTrendPoint } from "@/lib/dashboard/mock-data"

export function VisibilityTrendChart({
  data,
}: {
  data: VisibilityTrendPoint[]
}) {
  const { brand } = useAuth()
  const brandName = brand?.company_name?.trim() || "Your Brand"
  const competitors = brand?.competitors ?? []

  const chartConfig: ChartConfig = {
    brand: {
      label: brandName,
      color: "var(--chart-1)",
    },
    competitor1: {
      label: competitors[0]?.name ?? "Competitor 1",
      color: "var(--chart-2)",
    },
    competitor2: {
      label: competitors[1]?.name ?? "Competitor 2",
      color: "var(--chart-3)",
    },
    competitor3: {
      label: competitors[2]?.name ?? "Competitor 3",
      color: "var(--chart-4)",
    },
  } satisfies ChartConfig

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Visibility Trend</CardTitle>
        <CardDescription className="text-xs">
          Brand mentions across LLM platforms over time
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
          <LineChart
            data={data}
            margin={{ top: 8, right: 8, bottom: 0, left: -20 }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              domain={[0, 70]}
              tickFormatter={(value: number) => `${value}%`}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => value as string}
                  formatter={(value, name) => {
                    const config = chartConfig[name as string]
                    return (
                      <div className="flex items-center gap-2">
                        <div
                          className="size-2 shrink-0 rounded-[2px]"
                          style={{
                            backgroundColor: config?.color ?? "var(--primary)",
                          }}
                        />
                        <span className="text-muted-foreground">
                          {config?.label ?? name}
                        </span>
                        <span className="ml-auto font-mono font-medium tabular-nums">
                          {value}%
                        </span>
                      </div>
                    )
                  }}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} />
            <Line
              type="monotone"
              dataKey="brand"
              stroke="var(--color-brand)"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="monotone"
              dataKey="competitor1"
              stroke="var(--color-competitor1)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="competitor2"
              stroke="var(--color-competitor2)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
            <Line
              type="monotone"
              dataKey="competitor3"
              stroke="var(--color-competitor3)"
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 3 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
