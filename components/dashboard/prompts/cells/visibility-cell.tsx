import { cn } from "@/lib/utils"

function getColorClass(percent: number) {
  if (percent >= 60) {
    return "bg-emerald-500"
  }

  if (percent >= 30) {
    return "bg-amber-500"
  }

  return "bg-rose-500"
}

export function VisibilityCell({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent))

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden bg-muted">
        <div
          className={cn("h-full", getColorClass(clamped))}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-8 text-xs tabular-nums text-foreground">
        {clamped}%
      </span>
    </div>
  )
}
