"use client"

import * as React from "react"

import { useAuth } from "@/components/auth-provider"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import type { ComparisonMatrixRow } from "@/lib/dashboard/mock-data"
import { comparisonMatrixProviders } from "@/lib/dashboard/mock-data"
import { cn } from "@/lib/utils"

function getCellColor(value: number): string {
  if (value === 0) return "transparent"
  if (value <= 15) return "oklch(0.92 0.05 70)"
  if (value <= 30) return "oklch(0.87 0.08 65)"
  if (value <= 45) return "oklch(0.82 0.11 60)"
  if (value <= 60) return "oklch(0.77 0.14 55)"
  if (value <= 80) return "oklch(0.72 0.15 50)"
  return "oklch(0.67 0.16 45)"
}

function getCellTextColor(value: number): string {
  if (value >= 70) return "rgba(255,255,255,0.95)"
  if (value === 0) return "var(--muted-foreground)"
  return "var(--foreground)"
}

export function ComparisonMatrix({ data }: { data: ComparisonMatrixRow[] }) {
  const { brand } = useAuth()
  const brandName = brand?.company_name?.trim() ?? ""
  const [visibleProviders, setVisibleProviders] = React.useState<Set<string>>(
    () => new Set(comparisonMatrixProviders)
  )

  function toggleProvider(provider: string) {
    setVisibleProviders((prev) => {
      const next = new Set(prev)
      if (next.has(provider)) {
        if (next.size > 1) next.delete(provider)
      } else {
        next.add(provider)
      }
      return next
    })
  }

  const activeProviders = comparisonMatrixProviders.filter((p) =>
    visibleProviders.has(p)
  )

  const allScores = data.flatMap((row) =>
    activeProviders.map((p) => row.scores[p] ?? 0).filter((v) => v > 0)
  )
  const avgScore =
    allScores.length > 0
      ? (allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(1)
      : "0"

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm font-medium">
              Comparison Matrix
            </CardTitle>
            <CardDescription className="text-xs">
              Compare visibility scores across different AI providers
            </CardDescription>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold tracking-tight text-primary">
              {avgScore}%
            </p>
            <p className="text-xs text-muted-foreground">Average Score</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex items-center gap-1.5">
          {comparisonMatrixProviders.map((provider) => {
            const isActive = visibleProviders.has(provider)
            return (
              <button
                key={provider}
                type="button"
                onClick={() => toggleProvider(provider)}
                className={cn(
                  "flex h-8 items-center gap-1.5 border px-3 text-xs font-medium transition-colors",
                  isActive
                    ? "border-foreground/20 bg-foreground/5 text-foreground"
                    : "border-transparent bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {provider}
              </button>
            )
          })}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="border-b pb-2.5 pl-1 text-left font-medium text-muted-foreground">
                  Competitors
                </th>
                {activeProviders.map((provider) => (
                  <th
                    key={provider}
                    className="border-b pb-2.5 text-center font-medium text-muted-foreground"
                  >
                    {provider}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => {
                const isOwn =
                  row.isOwnBrand ||
                  (brandName && row.name === brandName)
                const displayName =
                  isOwn && brandName ? brandName : row.name

                return (
                  <tr
                    key={row.name}
                    className="border-b last:border-0"
                  >
                    <td
                      className={cn(
                        "py-0 pl-1 pr-3",
                        isOwn && "bg-primary/5"
                      )}
                    >
                      <div className="flex items-center gap-1.5 py-2.5">
                        <span className="font-medium">{displayName}</span>
                        {isOwn && (
                          <span className="text-muted-foreground">(you)</span>
                        )}
                      </div>
                    </td>
                    {activeProviders.map((provider) => {
                      const score = row.scores[provider] ?? 0
                      return (
                        <td
                          key={provider}
                          className="p-0 text-center"
                        >
                          <div
                            className="flex h-full min-h-10 items-center justify-center font-medium tabular-nums"
                            style={{
                              backgroundColor: getCellColor(score),
                              color: getCellTextColor(score),
                            }}
                          >
                            {score}%
                          </div>
                        </td>
                      )
                    })}
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
