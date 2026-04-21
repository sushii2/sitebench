"use client"

import Image from "next/image"
import { useState } from "react"

import { ChartBarLineIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import { buildBrandLogoUrl } from "@/lib/brands"
import { resolveLogoDevPublicConfig } from "@/lib/logo-dev/config"
import { cn } from "@/lib/utils"

const LLM_PROVIDERS = [
  { name: "ChatGPT", domain: "openai.com" },
  { name: "Claude", domain: "anthropic.com" },
  { name: "Gemini", domain: "gemini.google.com" },
  { name: "Perplexity", domain: "perplexity.ai" },
  { name: "Grok", domain: "x.ai" },
] as const

type ProviderName = (typeof LLM_PROVIDERS)[number]["name"]

const PROMPT_TABS: {
  name: Extract<ProviderName, "ChatGPT" | "Claude" | "Perplexity">
  domain: string
}[] = [
  { name: "ChatGPT", domain: "openai.com" },
  { name: "Claude", domain: "anthropic.com" },
  { name: "Perplexity", domain: "perplexity.ai" },
]

const PROMPT_ROWS_BY_TAB: Record<
  (typeof PROMPT_TABS)[number]["name"],
  { topic: string; count: number; visibility: number }[]
> = {
  ChatGPT: [
    { topic: "brand and catalog discovery", count: 20, visibility: 38 },
    { topic: "use-case and category fit", count: 20, visibility: 51 },
    { topic: "style and frame selection", count: 20, visibility: 47 },
    { topic: "collections and innovation", count: 20, visibility: 46 },
  ],
  Claude: [
    { topic: "brand and catalog discovery", count: 20, visibility: 44 },
    { topic: "use-case and category fit", count: 20, visibility: 58 },
    { topic: "style and frame selection", count: 20, visibility: 41 },
    { topic: "collections and innovation", count: 20, visibility: 52 },
  ],
  Perplexity: [
    { topic: "brand and catalog discovery", count: 20, visibility: 35 },
    { topic: "use-case and category fit", count: 20, visibility: 49 },
    { topic: "style and frame selection", count: 20, visibility: 54 },
    { topic: "collections and innovation", count: 20, visibility: 39 },
  ],
}

// Default layout is a subtle zigzag of 5 logos; on card hover they align to a
// clean horizontal row. Values in px; stride = box size + gap.
const BOX_SIZE = 52
const COLUMN_STRIDE = 64
const ZIGZAG_OFFSET = 14

const LOGO_POSITIONS = LLM_PROVIDERS.map((_, index) => {
  const mid = (LLM_PROVIDERS.length - 1) / 2
  const x = (index - mid) * COLUMN_STRIDE
  return {
    restX: x,
    restY: index % 2 === 0 ? -ZIGZAG_OFFSET : ZIGZAG_OFFSET,
    hoverX: x,
  }
})

export function LlmAnalyticsSection() {
  let publishableKey: string | null = null
  try {
    publishableKey = resolveLogoDevPublicConfig().publishableKey
  } catch {
    publishableKey = null
  }

  return (
    <section
      id="analytics"
      className="relative mx-auto w-full max-w-5xl scroll-mt-24 overflow-hidden px-4 pt-20 pb-16 sm:pt-24 md:pt-28"
    >
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 pb-10 text-center sm:pb-14 md:pb-16">
        <h2 className="font-heading text-balance text-3xl leading-[1.05] tracking-[-0.02em] text-foreground sm:text-4xl md:text-5xl">
          Analyze traffic from all major LLMs.
        </h2>
        <p className="max-w-md text-balance text-sm leading-relaxed text-muted-foreground sm:text-base">
          See how AI agents are discovering your brand and optimize visibility
          to boost traffic.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <LogosCard publishableKey={publishableKey} />
        <PromptsCard publishableKey={publishableKey} />
      </div>
    </section>
  )
}

function LogosCard({ publishableKey }: { publishableKey: string | null }) {
  const [hovered, setHovered] = useState<ProviderName | null>(null)
  const [isCardHovered, setIsCardHovered] = useState(false)

  return (
    <article
      className="flex flex-col gap-5 border border-border bg-card p-5 shadow-xs sm:p-6"
      onMouseEnter={() => setIsCardHovered(true)}
      onMouseLeave={() => {
        setIsCardHovered(false)
        setHovered(null)
      }}
    >
      <div
        className={cn(
          "relative flex h-[220px] items-center justify-center overflow-hidden border border-border bg-muted/40 sm:h-[260px]",
          "bg-[radial-gradient(ellipse_at_center,--theme(--color-foreground/.05),transparent_70%)]"
        )}
      >
        <div className="relative h-full w-full">
          {LLM_PROVIDERS.map((provider, index) => {
            const position = LOGO_POSITIONS[index]
            const isHovered = hovered === provider.name
            const translateX = isCardHovered ? position.hoverX : position.restX
            const translateY = isCardHovered ? 0 : position.restY

            return (
              <div
                key={provider.name}
                style={{
                  transform: `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px))`,
                }}
                className="absolute top-1/2 left-1/2 transition-transform duration-500 ease-out"
              >
                <LogoTile
                  provider={provider}
                  publishableKey={publishableKey}
                  isHovered={isHovered}
                  anyHovered={hovered !== null}
                  onHoverStart={() => setHovered(provider.name)}
                  onHoverEnd={() => setHovered(null)}
                />
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="font-heading text-lg tracking-tight text-foreground">
          See how AI talks about you
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Get real visibility into when and how AI agents recommend your brand
          across ChatGPT, Claude, Gemini, Grok &amp; more.
        </p>
      </div>
    </article>
  )
}

function LogoTile({
  provider,
  publishableKey,
  isHovered,
  anyHovered,
  onHoverStart,
  onHoverEnd,
}: {
  provider: (typeof LLM_PROVIDERS)[number]
  publishableKey: string | null
  isHovered: boolean
  anyHovered: boolean
  onHoverStart: () => void
  onHoverEnd: () => void
}) {
  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={onHoverStart}
      onMouseLeave={onHoverEnd}
      onFocus={onHoverStart}
      onBlur={onHoverEnd}
    >
      <div
        className={cn(
          "flex items-center justify-center overflow-hidden rounded-xl border border-border bg-background shadow-xs",
          "size-[52px] transition-all duration-300 ease-out",
          isHovered &&
            "scale-110 border-foreground/40 bg-card shadow-md ring-1 ring-foreground/10",
          anyHovered && !isHovered && "opacity-60"
        )}
        tabIndex={0}
        aria-label={provider.name}
      >
        {publishableKey ? (
          <Image
            src={buildBrandLogoUrl(provider.domain, publishableKey)}
            alt={provider.name}
            width={32}
            height={32}
            unoptimized
            className="size-7 rounded-md object-contain"
          />
        ) : (
          <span className="font-mono text-[10px] font-medium text-muted-foreground">
            {provider.name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
      <span
        aria-hidden={!isHovered}
        className={cn(
          "pointer-events-none absolute top-full mt-2 whitespace-nowrap text-xs font-medium text-foreground",
          "translate-y-1 opacity-0 transition-all duration-200 ease-out",
          isHovered && "translate-y-0 opacity-100"
        )}
      >
        {provider.name}
      </span>
    </div>
  )
}

function PromptsCard({ publishableKey }: { publishableKey: string | null }) {
  const [activeTab, setActiveTab] =
    useState<(typeof PROMPT_TABS)[number]["name"]>("ChatGPT")
  const rows = PROMPT_ROWS_BY_TAB[activeTab]

  return (
    <article className="flex flex-col gap-5 border border-border bg-card p-5 shadow-xs sm:p-6">
      <div className="relative flex h-[220px] flex-col overflow-hidden border border-border bg-background p-4 sm:h-[260px] sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HugeiconsIcon
              icon={ChartBarLineIcon}
              strokeWidth={2}
              className="size-3.5 text-muted-foreground"
            />
            <span className="font-heading text-xs tracking-tight">Prompts</span>
          </div>
          <Badge variant="outline" className="font-mono text-[10px]">
            60 tracked
          </Badge>
        </div>

        <div
          role="tablist"
          aria-label="AI engine"
          className="flex items-center gap-3 border-b border-border"
        >
          {PROMPT_TABS.map((tab) => {
            const isActive = activeTab === tab.name
            return (
              <button
                key={tab.name}
                role="tab"
                type="button"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.name)}
                className={cn(
                  "-mb-px flex items-center gap-1.5 border-b-2 pb-1.5 text-[11px] font-medium transition-colors",
                  isActive
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {publishableKey ? (
                  <Image
                    src={buildBrandLogoUrl(tab.domain, publishableKey)}
                    alt=""
                    width={14}
                    height={14}
                    unoptimized
                    aria-hidden="true"
                    className={cn(
                      "size-3.5 rounded-sm object-contain",
                      !isActive && "opacity-70"
                    )}
                  />
                ) : null}
                <span>{tab.name}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-2 flex items-center justify-between pb-1 text-[10px] font-medium tracking-wide text-muted-foreground uppercase">
          <span>Topic</span>
          <span>Avg. Visibility</span>
        </div>

        <ul className="flex flex-1 flex-col">
          {rows.map((row) => (
            <li
              key={row.topic}
              className="flex items-center gap-3 border-t border-border py-1.5 text-[11px] sm:py-2 sm:text-xs"
            >
              <span className="flex-1 truncate font-medium text-foreground">
                {row.topic}
              </span>
              <span className="hidden rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
                {row.count}
              </span>
              <div className="flex items-center gap-2">
                <div className="relative h-1 w-14 overflow-hidden rounded-full bg-muted sm:w-20">
                  <div
                    className="h-full rounded-full bg-chart-1"
                    style={{ width: `${row.visibility}%` }}
                  />
                </div>
                <span className="w-8 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                  {row.visibility}%
                </span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="font-heading text-lg tracking-tight text-foreground">
          Maintain a vast library of prompts
        </h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Track competitors&apos; citation, visibility, and sentiment across
          every AI answer engine.
        </p>
      </div>
    </article>
  )
}

