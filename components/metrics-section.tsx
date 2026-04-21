import Image from "next/image"

import {
  RankingIcon,
  ScanEyeIcon,
  SmileIcon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { buildBrandLogoUrl } from "@/lib/brands/logo"
import { resolveLogoDevPublicConfig } from "@/lib/logo-dev/config"
import { cn } from "@/lib/utils"

type Brand = { name: string; domain: string }

const BRANDS: readonly Brand[] = [
  { name: "Vercel", domain: "vercel.com" },
  { name: "Firebase", domain: "firebase.google.com" },
  { name: "Netlify", domain: "netlify.com" },
]

const SENTIMENT_LABELS = ["Positive", "Neutral", "Negative"] as const

export function MetricsSection() {
  let publishableKey: string | null = null
  try {
    publishableKey = resolveLogoDevPublicConfig().publishableKey
  } catch {
    publishableKey = null
  }

  return (
    <section
      id="metrics"
      className="relative mx-auto w-full max-w-5xl scroll-mt-24 px-4 pt-16 pb-20 sm:pt-20 md:pt-24"
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 pb-10 text-center sm:pb-14 md:pb-16">
        <h2 className="font-heading text-balance text-3xl leading-[1.05] tracking-[-0.02em] text-foreground sm:text-4xl md:text-5xl">
          The metrics that matter for AI search.
        </h2>
        <p className="max-w-md text-balance text-sm leading-relaxed text-muted-foreground sm:text-base">
          Track visibility, benchmark ranking against competitors, and read
          sentiment across every major AI answer engine.
        </p>
      </div>

      <div className="relative border border-border bg-card">
        <div className="grid grid-cols-1 md:grid-cols-3">
          <MetricColumn
            icon={ScanEyeIcon}
            title="Visibility"
            description="Know exactly how often your brand surfaces in AI-generated answers across every prompt you track."
            preview={<VisibilityPreview publishableKey={publishableKey} />}
          />
          <MetricColumn
            icon={RankingIcon}
            title="Ranking"
            description="Watch where you sit against competitors in every LLM response and see your position shift over time."
            preview={<RankingPreview publishableKey={publishableKey} />}
          />
          <MetricColumn
            icon={SmileIcon}
            title="Sentiment"
            description="Read the tone of every mention, from enthusiastic recommendation to hesitant caveat."
            preview={<SentimentPreview publishableKey={publishableKey} />}
            isLast
          />
        </div>
      </div>
    </section>
  )
}

function MetricColumn({
  icon,
  title,
  description,
  preview,
  isLast = false,
}: {
  icon: Parameters<typeof HugeiconsIcon>[0]["icon"]
  title: string
  description: string
  preview: React.ReactNode
  isLast?: boolean
}) {
  return (
    <div className="relative flex flex-col p-6 sm:p-7">
      <div className="relative mb-6 flex h-[180px] items-center justify-center overflow-hidden border border-border bg-[radial-gradient(ellipse_at_center,--theme(--color-foreground/.04),transparent_70%)] sm:h-[200px]">
        {preview}
      </div>

      <div className="flex items-center gap-2 pb-1.5">
        <HugeiconsIcon
          icon={icon}
          strokeWidth={1.75}
          className="size-5 text-muted-foreground"
        />
        <h3 className="font-heading text-lg tracking-tight text-foreground">
          {title}
        </h3>
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      {!isLast ? (
        <DashedLine className="right-5 bottom-0 left-5 md:top-5 md:right-0 md:bottom-5 md:left-full" />
      ) : null}
    </div>
  )
}

function DashedLine({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute border-collapse border border-border",
        className
      )}
      {...props}
    />
  )
}

function BrandLogo({
  brand,
  publishableKey,
  size = 20,
}: {
  brand: Brand
  publishableKey: string | null
  size?: number
}) {
  return (
    <span className="flex size-7 shrink-0 items-center justify-center border border-border bg-background">
      {publishableKey ? (
        <Image
          src={buildBrandLogoUrl(brand.domain, publishableKey)}
          alt=""
          width={size}
          height={size}
          unoptimized
          aria-hidden="true"
          className="size-4 rounded-sm object-contain"
        />
      ) : (
        <span className="font-mono text-[9px] font-medium text-muted-foreground">
          {brand.name.slice(0, 2).toUpperCase()}
        </span>
      )}
    </span>
  )
}

function VisibilityPreview({
  publishableKey,
}: {
  publishableKey: string | null
}) {
  const vercel = BRANDS[0]

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-5 left-1/2 z-20 w-[192px] border border-foreground bg-foreground px-3 py-2.5 text-background shadow-md"
        style={{
          animation: "metrics-card 5s ease-in-out infinite",
          willChange: "transform, opacity",
        }}
      >
        <div className="flex items-center gap-2 border-b border-background/15 pb-1.5">
          <BrandLogo brand={vercel} publishableKey={publishableKey} />
          <span className="text-[11px] font-medium">{vercel.name}</span>
        </div>
        <dl className="mt-2 flex flex-col gap-1 text-[10px] leading-tight">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-background/60">Visibility</dt>
            <dd className="font-mono tabular-nums">72%</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-background/60">Ranking</dt>
            <dd className="font-mono tabular-nums">#1</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-background/60">Sentiment</dt>
            <dd>Positive</dd>
          </div>
        </dl>
      </div>

      <div className="relative z-10 flex size-14 items-center justify-center border border-border bg-background shadow-xs">
        <BrandLogo
          brand={vercel}
          publishableKey={publishableKey}
          size={32}
        />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-1/2 z-30"
        style={{
          animation: "metrics-cursor 5s ease-in-out infinite",
          willChange: "transform, opacity",
        }}
      >
        <svg
          width="14"
          height="18"
          viewBox="0 0 14 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="drop-shadow-sm"
        >
          <path
            d="M1 1 L1 13.5 L4 10.5 L6.4 15.8 L8.2 15 L5.8 9.8 L10 9.8 Z"
            fill="var(--foreground)"
            stroke="var(--background)"
            strokeWidth="1"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  )
}

function RankingPreview({
  publishableKey,
}: {
  publishableKey: string | null
}) {
  return (
    <div className="flex w-full flex-col gap-2 px-6">
      {BRANDS.map((brand, index) => (
        <div
          key={brand.name}
          className="relative flex items-center overflow-hidden"
        >
          <span
            aria-hidden="true"
            className="absolute left-0 font-mono text-xs font-medium tabular-nums text-foreground"
            style={{
              animation: `metrics-rank-reveal 4.5s ${index * 120}ms ease-out infinite`,
              willChange: "transform, opacity",
            }}
          >
            #{index + 1}
          </span>
          <div
            className="flex flex-1 items-center gap-2"
            style={{
              animation: `metrics-row-shift 4.5s ${index * 120}ms ease-in-out infinite`,
              willChange: "transform",
            }}
          >
            <BrandLogo brand={brand} publishableKey={publishableKey} />
            <span className="text-xs font-medium text-foreground">
              {brand.name}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function SentimentPreview({
  publishableKey,
}: {
  publishableKey: string | null
}) {
  return (
    <div className="flex w-full flex-col gap-2 px-6">
      {BRANDS.map((brand, index) => (
        <div key={brand.name} className="flex items-center gap-2">
          <BrandLogo brand={brand} publishableKey={publishableKey} />
          <span className="flex-1 text-xs font-medium text-foreground">
            {brand.name}
          </span>
          <span
            className="inline-flex items-center border border-foreground bg-foreground px-2 py-0.5 text-[10px] font-medium tracking-tight text-background"
            style={{
              animation: `metrics-label-appear 4.5s ${400 + index * 140}ms ease-out infinite`,
              willChange: "transform, opacity",
            }}
          >
            {SENTIMENT_LABELS[index]}
          </span>
        </div>
      ))}
    </div>
  )
}
