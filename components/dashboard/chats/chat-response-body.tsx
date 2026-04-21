"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Badge } from "@/components/ui/badge"
import type { ChatResponseView } from "@/lib/chats/types"

function formatResponded(iso: string | null): string {
  if (!iso) {
    return "—"
  }

  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  })
}

export function ChatResponseBody({ view }: { view: ChatResponseView }) {
  const { response } = view

  if (response.status !== "completed") {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <p className="font-medium">
          {view.platformLabel} · {response.status.replace(/_/g, " ")}
        </p>
        {response.error_message ? (
          <p className="mt-2 text-muted-foreground">{response.error_message}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{view.platformLabel}</Badge>
        {response.provider_model ? (
          <span>{response.provider_model}</span>
        ) : null}
        <span>Responded {formatResponded(response.responded_at)}</span>
        {response.latency_ms !== null ? (
          <span>{response.latency_ms} ms</span>
        ) : null}
      </div>
      <article className="prose prose-neutral max-w-none text-sm dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {response.raw_response_text ?? ""}
        </ReactMarkdown>
      </article>
    </div>
  )
}
