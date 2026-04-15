"use client"

import * as React from "react"

import { useAuth } from "@/components/auth-provider"
import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { ProviderRankingsData } from "@/lib/dashboard/mock-data"
import { cn } from "@/lib/utils"

const providers = ["ChatGPT", "Claude", "Gemini", "Grok"]

const sentimentVariant: Record<string, "default" | "secondary" | "destructive"> = {
  Positive: "default",
  Neutral: "secondary",
  Negative: "destructive",
}

function getValueCellColor(value: number): string {
  if (value === 0) return "transparent"
  if (value <= 15) return "oklch(0.92 0.05 70)"
  if (value <= 25) return "oklch(0.87 0.08 65)"
  if (value <= 40) return "oklch(0.82 0.11 60)"
  if (value <= 55) return "oklch(0.77 0.14 55)"
  if (value <= 70) return "oklch(0.72 0.15 50)"
  return "oklch(0.67 0.16 45)"
}

function getValueTextColor(value: number): string {
  if (value >= 65) return "rgba(255,255,255,0.95)"
  if (value === 0) return "var(--muted-foreground)"
  return "var(--foreground)"
}

export function ProviderRankings({ data }: { data: ProviderRankingsData }) {
  const [activeProvider, setActiveProvider] = React.useState("ChatGPT")
  const { brand } = useAuth()
  const brandName = brand?.company_name?.trim() ?? ""

  const rows = data[activeProvider] ?? []
  const ownRow = rows.find(
    (r) => r.isOwnBrand || (brandName && r.name === brandName)
  )
  const avgRank = ownRow?.rank ?? "--"

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm font-medium">
              Provider Rankings
            </CardTitle>
            <CardDescription className="text-xs">
              Your brand performance by AI provider
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tracking-tight text-primary">
              #{avgRank}
            </p>
            <p className="text-xs text-muted-foreground">Average Rank</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-1.5">
          {providers.map((provider) => (
            <button
              key={provider}
              type="button"
              onClick={() => setActiveProvider(provider)}
              className={cn(
                "flex h-8 items-center gap-1.5 border px-3 text-xs font-medium transition-colors",
                activeProvider === provider
                  ? "border-foreground/20 bg-foreground/5 text-foreground"
                  : "border-transparent bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {provider}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border-b pb-2.5 text-left font-medium text-muted-foreground">
                  #
                </th>
                <th className="border-b pb-2.5 text-left font-medium text-muted-foreground">
                  Company
                </th>
                <th className="border-b pb-2.5 text-center font-medium text-muted-foreground">
                  Visibility
                </th>
                <th className="border-b pb-2.5 text-center font-medium text-muted-foreground">
                  Share of Voice
                </th>
                <th className="border-b pb-2.5 text-right font-medium text-muted-foreground">
                  Sentiment
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isOwn =
                  row.isOwnBrand || (brandName && row.name === brandName)
                const displayName = isOwn && brandName ? brandName : row.name

                return (
                  <tr
                    key={row.name}
                    className={cn(
                      "border-b last:border-0",
                      isOwn && "bg-primary/5"
                    )}
                  >
                    <td className="py-2.5 pr-2 font-mono text-muted-foreground">
                      {row.rank}
                    </td>
                    <td className="py-2.5 pr-3">
                      <span className="font-medium">{displayName}</span>
                      {isOwn && (
                        <span className="ml-1 text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </td>
                    <td className="p-0 text-center">
                      <div
                        className="flex min-h-10 items-center justify-center font-medium tabular-nums"
                        style={{
                          backgroundColor: getValueCellColor(row.visibility),
                          color: getValueTextColor(row.visibility),
                        }}
                      >
                        {row.visibility}%
                      </div>
                    </td>
                    <td className="p-0 text-center">
                      <div
                        className="flex min-h-10 items-center justify-center font-medium tabular-nums"
                        style={{
                          backgroundColor: getValueCellColor(row.shareOfVoice),
                          color: getValueTextColor(row.shareOfVoice),
                        }}
                      >
                        {row.shareOfVoice}%
                      </div>
                    </td>
                    <td className="py-2.5 text-right">
                      <Badge
                        variant={sentimentVariant[row.sentiment] ?? "secondary"}
                        className="text-[10px]"
                      >
                        {row.sentiment}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}
