"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const UNLOCK_LABELS = ["GEO", "AEO", "AIO"] as const
const SHOW_DURATION_MS = 1800
const SWAP_DURATION_MS = 500

type UnlockingOverlayProps = {
  open: boolean
  title?: string
}

export function UnlockingOverlay({
  open,
  title = "Setting up your workspace",
}: UnlockingOverlayProps) {
  const [index, setIndex] = React.useState(0)
  const [visible, setVisible] = React.useState(true)

  React.useEffect(() => {
    if (!open) {
      setIndex(0)
      setVisible(true)
      return
    }

    if (visible) {
      const id = window.setTimeout(() => setVisible(false), SHOW_DURATION_MS)
      return () => window.clearTimeout(id)
    }

    const id = window.setTimeout(() => {
      setIndex((i) => (i + 1) % UNLOCK_LABELS.length)
      setVisible(true)
    }, SWAP_DURATION_MS)
    return () => window.clearTimeout(id)
  }, [open, visible])

  if (!open) return null

  const current = UNLOCK_LABELS[index]

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background/95 backdrop-blur"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-8 items-center justify-center rounded-md bg-foreground text-background">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
            aria-hidden="true"
          >
            <rect x="3" y="3" width="18" height="18" rx="4" />
            <path d="M7 12h10M12 7v10" />
          </svg>
        </span>
        <span className="font-heading text-base font-medium tracking-tight">
          Sitebench
        </span>
      </div>

      <div className="flex flex-col items-center gap-3 text-center">
        <p className="font-mono text-3xl font-medium tracking-tight text-foreground md:text-4xl">
          <span>Unlocking </span>
          <span className="inline-flex items-center">
            <span
              aria-hidden="true"
              className={cn(
                "inline-block overflow-hidden whitespace-nowrap transition-[max-width,opacity] duration-500 ease-out",
                visible ? "max-w-[6ch] opacity-100" : "max-w-0 opacity-0"
              )}
            >
              {current}
            </span>
            <span
              aria-hidden="true"
              className="ml-0.5 inline-block h-[0.9em] w-[2px] bg-foreground align-middle motion-safe:animate-pulse"
            />
            <span className="sr-only">Unlocking {current}</span>
          </span>
        </p>
        <p className="max-w-sm text-sm text-muted-foreground">
          {title}. This usually takes a few seconds.
        </p>
      </div>
    </div>
  )
}
