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
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart"
import { useLogoDevPublishableKey } from "@/hooks/use-logo-dev-key"
import { buildBrandLogoUrl } from "@/lib/brands/logo"
import { parsePublicWebsiteUrl } from "@/lib/brands/validation"
import type { VisibilityTrendPoint } from "@/lib/dashboard/mock-data"

function toHostname(value: string | null | undefined): string | null {
  if (!value) return null
  const url = parsePublicWebsiteUrl(value)
  return url?.hostname ?? value.toLowerCase()
}

const FALLBACK_DOMAINS = {
  brand: "pillows.com",
  competitor1: "brooklinen.com",
  competitor2: "coophomegoods.com",
  competitor3: "tempurpedic.com",
} as const

export function VisibilityTrendChart({
  data,
}: {
  data: VisibilityTrendPoint[]
}) {
  const { brand } = useAuth()
  const publishableKey = useLogoDevPublishableKey()
  const brandName = brand?.company_name?.trim() || "Your Brand"
  const competitors = brand?.competitors ?? []

  const dataKeyToDomain: Record<string, string> = {
    brand: toHostname(brand?.website) ?? FALLBACK_DOMAINS.brand,
    competitor1:
      toHostname(competitors[0]?.website) ?? FALLBACK_DOMAINS.competitor1,
    competitor2:
      toHostname(competitors[1]?.website) ?? FALLBACK_DOMAINS.competitor2,
    competitor3:
      toHostname(competitors[2]?.website) ?? FALLBACK_DOMAINS.competitor3,
  }

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
                    const domain = dataKeyToDomain[name as string]
                    const logoUrl =
                      publishableKey && domain
                        ? buildBrandLogoUrl(domain, publishableKey)
                        : null
                    return (
                      <div className="flex items-center gap-2">
                        {logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={logoUrl}
                            alt=""
                            width={14}
                            height={14}
                            className="size-3.5 shrink-0 rounded-[2px] object-contain"
                          />
                        ) : (
                          <div
                            className="size-2 shrink-0 rounded-[2px]"
                            style={{
                              backgroundColor: config?.color ?? "var(--primary)",
                            }}
                          />
                        )}
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
            <ChartLegend
              content={(props) => (
                <VisibilityTrendLegend
                  payload={props.payload}
                  chartConfig={chartConfig}
                  domainMap={dataKeyToDomain}
                  publishableKey={publishableKey}
                />
              )}
            />
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

type LegendItem = {
  dataKey?: unknown
  color?: string
}

function VisibilityTrendLegend({
  payload,
  chartConfig,
  domainMap,
  publishableKey,
}: {
  payload?: readonly LegendItem[]
  chartConfig: ChartConfig
  domainMap: Record<string, string>
  publishableKey: string | null
}) {
  if (!payload?.length) return null

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 pt-3">
      {payload.map((item) => {
        const key =
          typeof item.dataKey === "string" || typeof item.dataKey === "number"
            ? String(item.dataKey)
            : ""
        const config = chartConfig[key]
        const domain = domainMap[key]
        const logoUrl =
          publishableKey && domain
            ? buildBrandLogoUrl(domain, publishableKey)
            : null

        return (
          <div key={key} className="flex items-center gap-1.5 text-xs">
            <span
              className="h-0.5 w-3.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                width={14}
                height={14}
                className="size-3.5 shrink-0 rounded-[2px] object-contain"
              />
            ) : null}
            <span className="text-muted-foreground">{config?.label ?? key}</span>
          </div>
        )
      })}
    </div>
  )
}
