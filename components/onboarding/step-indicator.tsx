import { HugeiconsIcon } from "@hugeicons/react"
import { Tick02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"

export type StepStatus = "done" | "current" | "upcoming"

type StepIndicatorProps = {
  index: number
  label: string
  status: StepStatus
  optional?: boolean
}

export function StepIndicator({
  index,
  label,
  status,
  optional,
}: StepIndicatorProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium",
          status === "done" &&
            "bg-emerald-500 text-white",
          status === "current" &&
            "border-2 border-sidebar-foreground text-sidebar-foreground",
          status === "upcoming" &&
            "border border-sidebar-foreground/30 text-sidebar-foreground/60"
        )}
        aria-current={status === "current" ? "step" : undefined}
      >
        {status === "done" ? (
          <HugeiconsIcon
            icon={Tick02Icon}
            strokeWidth={2.5}
            className="size-3.5"
          />
        ) : (
          index
        )}
      </span>
      <div className="flex min-w-0 flex-col">
        <span
          className={cn(
            "text-sm leading-5",
            status === "upcoming"
              ? "text-sidebar-foreground/60"
              : "text-sidebar-foreground",
            status === "current" && "font-medium"
          )}
        >
          {label}
        </span>
        {optional ? (
          <span className="text-[11px] text-sidebar-foreground/50">
            Optional
          </span>
        ) : null}
      </div>
    </div>
  )
}
