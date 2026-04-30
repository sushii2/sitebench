"use client"

import { ArrowUp01Icon, ArrowDown01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { useAuth } from "@/components/auth-provider"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useLogoDevPublishableKey } from "@/hooks/use-logo-dev-key"
import { buildBrandLogoUrl } from "@/lib/brands/logo"
import { parsePublicWebsiteUrl } from "@/lib/brands/validation"
import type { CompetitorRanking } from "@/lib/dashboard/mock-data"
import { cn } from "@/lib/utils"

function toHostname(value: string | null | undefined): string | null {
  if (!value) return null
  const url = parsePublicWebsiteUrl(value)
  return url?.hostname ?? value.toLowerCase()
}

export function CompetitorRankings({
  rankings,
}: {
  rankings: CompetitorRanking[]
}) {
  const { brand } = useAuth()
  const brandName = brand?.company_name?.trim() ?? ""
  const publishableKey = useLogoDevPublishableKey()

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">
          Competitor Rankings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-0">
        {rankings.map((item, index) => {
          const isOwnBrand =
            item.name === "Your Brand" ||
            (brandName && item.name === brandName)
          const websiteForLogo =
            (isOwnBrand && toHostname(brand?.website)) ||
            toHostname(item.website)
          const logoUrl =
            publishableKey && websiteForLogo
              ? buildBrandLogoUrl(websiteForLogo, publishableKey)
              : null
          const displayName =
            isOwnBrand && brandName ? brandName : item.name

          return (
            <div key={item.name}>
              {index > 0 && <Separator />}
              <div
                className={cn(
                  "flex items-center gap-3 py-2.5",
                  isOwnBrand && "bg-primary/5 -mx-6 px-6"
                )}
              >
                <span className="w-5 text-center font-mono text-xs text-muted-foreground">
                  {item.rank}
                </span>
                <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-border/60 bg-background">
                  {logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={logoUrl}
                      alt=""
                      width={28}
                      height={28}
                      className="size-full object-contain"
                    />
                  ) : (
                    <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                      {displayName.slice(0, 2)}
                    </span>
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {displayName}
                    {isOwnBrand && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        (you)
                      </span>
                    )}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {isOwnBrand && brand?.website
                      ? brand.website
                      : item.website}
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums">
                  {item.visibility}%
                </span>
                <div className="flex w-8 items-center justify-end">
                  {item.rankChange > 0 ? (
                    <HugeiconsIcon
                      icon={ArrowUp01Icon}
                      strokeWidth={2}
                      className="size-3.5 text-emerald-600 dark:text-emerald-400"
                    />
                  ) : item.rankChange < 0 ? (
                    <HugeiconsIcon
                      icon={ArrowDown01Icon}
                      strokeWidth={2}
                      className="size-3.5 text-destructive"
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">--</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
