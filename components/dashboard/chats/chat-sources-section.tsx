"use client"

import * as React from "react"
import {
  ArrowDown01Icon,
  ArrowUpRight01Icon,
  Link04Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { useLogoDevPublishableKey } from "@/hooks/use-logo-dev-key"
import { buildBrandLogoUrl } from "@/lib/brands/logo"
import type { ChatSource, ChatSourceGroup } from "@/lib/chats/types"
import { cn } from "@/lib/utils"

function sortByOrder(sources: ChatSource[]): ChatSource[] {
  return [...sources].sort((a, b) => {
    const ao = a.citation.citation_order ?? Number.MAX_SAFE_INTEGER
    const bo = b.citation.citation_order ?? Number.MAX_SAFE_INTEGER

    return ao - bo
  })
}

function SourceRow({
  source,
  publishableKey,
}: {
  source: ChatSource
  publishableKey: string | null
}) {
  const title = source.page.page_title?.trim() || source.domain.domain
  const logoUrl = publishableKey
    ? buildBrandLogoUrl(source.domain.domain, publishableKey)
    : null
  const matchedRole = source.matchedBrand?.role ?? null

  return (
    <li>
      <a
        href={source.citation.cited_url}
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center gap-2.5 rounded-md border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-muted/40"
      >
        <span
          className={cn(
            "flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-[10px] font-medium uppercase text-muted-foreground",
            matchedRole === "primary" && "ring-1 ring-foreground"
          )}
        >
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              width={24}
              height={24}
              className="size-full object-contain"
            />
          ) : (
            <HugeiconsIcon
              icon={Link04Icon}
              strokeWidth={2}
              className="size-3"
            />
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium text-foreground">
            {title}
          </span>
          <span className="truncate text-[11px] text-muted-foreground">
            {source.domain.domain}
          </span>
        </span>
        {source.matchedBrand ? (
          <span
            className={cn(
              "shrink-0 rounded-sm px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide",
              matchedRole === "primary"
                ? "bg-foreground text-background"
                : "bg-muted text-foreground"
            )}
          >
            {source.matchedBrand.name}
          </span>
        ) : null}
        <HugeiconsIcon
          icon={ArrowUpRight01Icon}
          strokeWidth={2}
          className="size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
        />
      </a>
    </li>
  )
}

export function ChatSourcesSection({ group }: { group: ChatSourceGroup }) {
  const [open, setOpen] = React.useState(true)
  const publishableKey = useLogoDevPublishableKey()

  const cited = sortByOrder(group.cited)
  const notCited = sortByOrder(group.notCited)
  const total = cited.length + notCited.length

  if (total === 0) {
    return (
      <section className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
        No citations recorded for this response.
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <HugeiconsIcon
            icon={Link04Icon}
            strokeWidth={2}
            className="size-4 text-muted-foreground"
          />
          <span className="text-sm font-medium">Sources</span>
          <span className="rounded-sm bg-muted px-1.5 py-0.5 text-[11px] tabular-nums text-muted-foreground">
            {total}
          </span>
        </div>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          strokeWidth={2}
          className={cn(
            "size-4 text-muted-foreground transition-transform",
            open ? "" : "-rotate-90"
          )}
        />
      </button>

      {open ? (
        <div className="flex flex-col gap-4 border-t border-border p-4">
          {cited.length > 0 ? (
            <div className="flex flex-col gap-1">
              <h3 className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Brand matches ({cited.length})
              </h3>
              <ul className="flex flex-col gap-0.5">
                {cited.map((source) => (
                  <SourceRow
                    key={source.citation.id}
                    source={source}
                    publishableKey={publishableKey}
                  />
                ))}
              </ul>
            </div>
          ) : null}

          {notCited.length > 0 ? (
            <div className="flex flex-col gap-1">
              <h3 className="px-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Other sources ({notCited.length})
              </h3>
              <ul className="flex flex-col gap-0.5">
                {notCited.map((source) => (
                  <SourceRow
                    key={source.citation.id}
                    source={source}
                    publishableKey={publishableKey}
                  />
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
