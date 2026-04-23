"use client"

import { useLogoDevPublishableKey } from "@/hooks/use-logo-dev-key"
import { buildPlatformLogoUrl } from "@/lib/ai-platforms/logos"
import type { ChatResponseView } from "@/lib/chats/types"
import { cn } from "@/lib/utils"

const STATUS_DOT: Record<string, string> = {
  completed: "bg-emerald-500",
  failed: "bg-rose-500",
  timeout: "bg-amber-500",
  blocked: "bg-rose-500",
  rate_limited: "bg-amber-500",
  missing: "bg-muted-foreground/40",
}

export function ChatPlatformToggle({
  activeCode,
  onChange,
  responses,
}: {
  activeCode: string
  onChange: (code: string) => void
  responses: ChatResponseView[]
}) {
  const publishableKey = useLogoDevPublishableKey()

  if (responses.length === 0) {
    return null
  }

  return (
    <div
      role="tablist"
      aria-label="Choose platform"
      className="flex w-fit items-center gap-1 rounded-lg border border-border bg-muted/40 p-1"
    >
      {responses.map((view) => {
        const code = view.response.platform_code
        const isActive = code === activeCode
        const logoUrl = buildPlatformLogoUrl(code, publishableKey)
        const status = view.response.status
        const dot = STATUS_DOT[status] ?? STATUS_DOT.missing

        return (
          <button
            key={view.response.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(code)}
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                width={16}
                height={16}
                className="size-4 object-contain"
              />
            ) : null}
            <span>{view.platformLabel}</span>
            <span
              className={cn("size-1.5 rounded-full", dot)}
              aria-hidden
              title={status}
            />
          </button>
        )
      })}
    </div>
  )
}
