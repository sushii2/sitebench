"use client"

import { ArrowUpRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { useLogoDevPublishableKey } from "@/hooks/use-logo-dev-key"
import type { BrandEntity } from "@/lib/brand-entities/types"
import { buildBrandLogoUrl } from "@/lib/brands/logo"
import type { ChatBrandMention } from "@/lib/chats/types"
import type { SentimentLabel } from "@/lib/response-brand-metrics/types"
import { cn } from "@/lib/utils"

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  )
}

function formatVisibility(score: number): string {
  return `${Math.round(Math.max(0, Math.min(100, score)))}%`
}

function formatPosition(rank: number | null): string {
  if (rank === null) {
    return "—"
  }

  return `#${rank}`
}

function formatSentimentScore(
  label: SentimentLabel,
  score: number | null
): string {
  if (score === null) {
    const defaults: Record<SentimentLabel, number> = {
      positive: 80,
      neutral: 50,
      mixed: 50,
      negative: 20,
    }

    return String(defaults[label])
  }

  if (score <= 1 && score >= -1) {
    return String(Math.round((score + 1) * 50))
  }

  return String(Math.round(score))
}

const SENTIMENT_BAR: Record<SentimentLabel, string> = {
  positive: "bg-emerald-500",
  neutral: "bg-muted-foreground/60",
  mixed: "bg-amber-500",
  negative: "bg-rose-500",
}

const VISIBILITY_DOT: (score: number) => string = (score) => {
  if (score >= 60) return "bg-emerald-500"
  if (score >= 30) return "bg-amber-500"
  return "bg-rose-500"
}

export function BrandStatCard({
  mention,
}: {
  mention: ChatBrandMention
}) {
  const { brand, metric } = mention
  const publishableKey = useLogoDevPublishableKey()
  const logoUrl =
    publishableKey && brand.website_host
      ? buildBrandLogoUrl(brand.website_host, publishableKey)
      : null

  const sentimentBar = SENTIMENT_BAR[metric.sentiment_label]
  const visibilityDot = VISIBILITY_DOT(metric.visibility_score)
  const websiteUrl =
    brand.website_url ||
    (brand.website_host ? `https://${brand.website_host}` : null)

  return (
    <div className="group relative flex flex-col gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-foreground/20">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-[10px] font-medium uppercase text-muted-foreground">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                width={28}
                height={28}
                className="size-full object-contain"
              />
            ) : (
              initials(brand.name)
            )}
          </span>
          <span className="truncate text-sm font-medium">{brand.name}</span>
          {brand.role === "primary" ? (
            <span className="shrink-0 rounded-sm bg-foreground/10 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-foreground">
              You
            </span>
          ) : null}
        </div>
        {websiteUrl ? (
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
            aria-label={`Open ${brand.name}`}
          >
            <HugeiconsIcon
              icon={ArrowUpRight01Icon}
              strokeWidth={2}
              className="size-4"
            />
          </a>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Visibility
          </span>
          <div className="flex items-center gap-1.5">
            <span className={cn("size-1.5 rounded-full", visibilityDot)} />
            <span className="text-sm font-semibold tabular-nums">
              {formatVisibility(metric.visibility_score)}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Sentiment
          </span>
          <div className="flex items-center gap-1.5">
            <span className={cn("h-3.5 w-0.5 rounded-full", sentimentBar)} />
            <span className="text-sm font-semibold tabular-nums">
              {formatSentimentScore(
                metric.sentiment_label,
                metric.sentiment_score
              )}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Position
          </span>
          <div className="flex items-center gap-1">
            <span className="text-sm font-semibold tabular-nums">
              {formatPosition(metric.rank_position)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

export function BrandStatCardSkeleton({ brand }: { brand: BrandEntity }) {
  const publishableKey = useLogoDevPublishableKey()
  const logoUrl =
    publishableKey && brand.website_host
      ? buildBrandLogoUrl(brand.website_host, publishableKey)
      : null

  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 p-3 text-xs text-muted-foreground">
      <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-background">
        {logoUrl ? (
          <img
            src={logoUrl}
            alt=""
            width={28}
            height={28}
            className="size-full object-contain opacity-60"
          />
        ) : (
          <span className="text-[10px] font-medium uppercase text-muted-foreground">
            {initials(brand.name)}
          </span>
        )}
      </span>
      <span className="truncate">{brand.name}</span>
      <span className="ml-auto text-[10px] uppercase tracking-wide">
        Not mentioned
      </span>
    </div>
  )
}
