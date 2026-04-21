"use client"

import * as React from "react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ChatsListRow } from "@/components/dashboard/chats/chats-list-row"
import { Button } from "@/components/ui/button"
import type { ChatSummary } from "@/lib/chats/types"

const PAGE_SIZE = 25

export function ChatsList({
  chats,
  hrefForChat,
}: {
  chats: ChatSummary[]
  hrefForChat: (promptRunId: string) => string
}) {
  const [page, setPage] = React.useState(0)

  const pageCount = Math.max(1, Math.ceil(chats.length / PAGE_SIZE))
  const effectivePage = Math.min(page, pageCount - 1)
  const start = effectivePage * PAGE_SIZE
  const rows = chats.slice(start, start + PAGE_SIZE)

  if (chats.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No chats match these filters.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        {rows.map((chat) => (
          <ChatsListRow
            key={chat.promptRunId}
            chat={chat}
            href={hrefForChat(chat.promptRunId)}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {rows.length} of {chats.length} chat
          {chats.length === 1 ? "" : "s"}
        </p>
        {pageCount > 1 ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setPage(Math.max(0, effectivePage - 1))}
              disabled={effectivePage === 0}
              aria-label="Previous page"
            >
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                strokeWidth={2}
                className="size-3.5"
              />
            </Button>
            <span className="px-2 tabular-nums">
              Page {effectivePage + 1} of {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setPage(Math.min(pageCount - 1, effectivePage + 1))}
              disabled={effectivePage === pageCount - 1}
              aria-label="Next page"
            >
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                strokeWidth={2}
                className="size-3.5"
              />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
