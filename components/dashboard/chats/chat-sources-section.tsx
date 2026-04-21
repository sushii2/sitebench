"use client"

import { LinkSquare01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import type { ChatSource, ChatSourceGroup } from "@/lib/chats/types"

function sortByOrder(sources: ChatSource[]): ChatSource[] {
  return [...sources].sort((a, b) => {
    const ao = a.citation.citation_order ?? Number.MAX_SAFE_INTEGER
    const bo = b.citation.citation_order ?? Number.MAX_SAFE_INTEGER

    return ao - bo
  })
}

function SourceLink({ source }: { source: ChatSource }) {
  const title = source.page.page_title ?? source.page.canonical_url

  return (
    <li className="flex flex-col gap-1 rounded-md border border-border p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{title}</span>
        {source.matchedBrand ? (
          <Badge
            variant={
              source.matchedBrand.role === "primary" ? "default" : "secondary"
            }
            className="text-[10px]"
          >
            {source.matchedBrand.name}
          </Badge>
        ) : null}
      </div>
      <a
        href={source.citation.cited_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <HugeiconsIcon
          icon={LinkSquare01Icon}
          strokeWidth={2}
          className="size-3"
        />
        <span className="truncate">{source.domain.domain}</span>
      </a>
    </li>
  )
}

export function ChatSourcesSection({ group }: { group: ChatSourceGroup }) {
  const cited = sortByOrder(group.cited)
  const notCited = sortByOrder(group.notCited)

  if (cited.length === 0 && notCited.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
        No citations recorded.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cited project brands ({cited.length})
        </h3>
        {cited.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No sources cited your brand or competitors.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {cited.map((source) => (
              <SourceLink key={source.citation.id} source={source} />
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Did not cite ({notCited.length})
        </h3>
        {notCited.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Every cited source matched a project brand.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {notCited.map((source) => (
              <SourceLink key={source.citation.id} source={source} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
