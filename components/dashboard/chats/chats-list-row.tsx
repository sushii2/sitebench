"use client"

import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import type { ChatSummary } from "@/lib/chats/types"

function formatScheduled(iso: string): string {
  const date = new Date(iso)

  return date.toLocaleString(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  })
}

function platformGlyph(status: ChatSummary["platforms"][number]["status"]): string {
  if (status === "completed") {
    return "✓"
  }

  if (status === "missing") {
    return "·"
  }

  return "✗"
}

export function ChatsListRow({
  chat,
  href,
}: {
  chat: ChatSummary
  href: string
}) {
  const completedPlatforms = chat.platforms.filter(
    (platform) => platform.status === "completed"
  ).length
  const totalPlatforms = chat.platforms.length
  const brandsToShow = chat.brandMentions.slice(0, 4)
  const extraBrands = Math.max(0, chat.brandMentions.length - brandsToShow.length)

  return (
    <Link
      href={href}
      className="block rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="line-clamp-2 text-sm font-medium">{chat.promptText}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{chat.topicName || "Untitled topic"}</Badge>
        <span>{formatScheduled(chat.scheduledFor)}</span>
        <span>
          {completedPlatforms}/{totalPlatforms} platforms{" "}
          <span aria-hidden className="tracking-widest">
            {chat.platforms.map((p) => platformGlyph(p.status)).join("")}
          </span>
        </span>
        <span>Sources: {chat.sourceCount}</span>
      </div>
      {brandsToShow.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {brandsToShow.map((brand) => (
            <Badge
              key={brand.brandEntityId}
              variant={brand.role === "primary" ? "default" : "secondary"}
              className="text-[10px]"
            >
              {brand.name}
            </Badge>
          ))}
          {extraBrands > 0 ? (
            <span className="text-xs text-muted-foreground">
              +{extraBrands}
            </span>
          ) : null}
        </div>
      ) : null}
    </Link>
  )
}
