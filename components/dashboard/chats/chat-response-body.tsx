"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { useLogoDevPublishableKey } from "@/hooks/use-logo-dev-key"
import { buildPlatformLogoUrl } from "@/lib/ai-platforms/logos"
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

function platformInitials(label: string): string {
  return label.charAt(0).toUpperCase() || "?"
}

export function ChatResponseBody({ view }: { view: ChatResponseView }) {
  const { response } = view
  const publishableKey = useLogoDevPublishableKey()
  const logoUrl = buildPlatformLogoUrl(response.platform_code, publishableKey)

  if (response.status !== "completed") {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-sm">
        <p className="font-medium">
          {view.platformLabel} didn&rsquo;t produce a response
        </p>
        <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">
          Status: {response.status.replace(/_/g, " ")}
        </p>
        {response.error_message ? (
          <p className="mt-3 text-sm text-muted-foreground">
            {response.error_message}
          </p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 border-b border-border pb-3">
        <span className="flex size-9 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-medium">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt=""
              width={36}
              height={36}
              className="size-full object-contain"
            />
          ) : (
            platformInitials(view.platformLabel)
          )}
        </span>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">{view.platformLabel}</span>
          <span className="text-[11px] text-muted-foreground tabular-nums">
            {response.provider_model ?? "model"} ·{" "}
            {formatResponded(response.responded_at)}
            {response.latency_ms !== null
              ? ` · ${(response.latency_ms / 1000).toFixed(1)}s`
              : ""}
          </span>
        </div>
      </header>

      <article className="prose prose-neutral max-w-none text-[15px] leading-relaxed dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-p:leading-7 prose-a:text-foreground prose-a:underline prose-a:decoration-foreground/40 prose-a:underline-offset-2 hover:prose-a:decoration-foreground prose-pre:bg-muted prose-pre:text-foreground prose-code:before:hidden prose-code:after:hidden">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {response.raw_response_text ?? ""}
        </ReactMarkdown>
      </article>
    </div>
  )
}
