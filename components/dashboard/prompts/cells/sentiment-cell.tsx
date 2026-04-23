import type { SentimentLabel } from "@/lib/response-brand-metrics/types"
import { cn } from "@/lib/utils"

const STYLES: Record<SentimentLabel, string> = {
  positive:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  neutral: "bg-muted text-muted-foreground",
  mixed: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  negative: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
}

const LABELS: Record<SentimentLabel, string> = {
  positive: "Positive",
  neutral: "Neutral",
  mixed: "Mixed",
  negative: "Negative",
}

export function SentimentCell({ tone }: { tone: SentimentLabel | null }) {
  if (!tone) {
    return <span className="text-xs text-muted-foreground">--</span>
  }

  return (
    <span
      className={cn(
        "inline-flex h-5 items-center px-2 text-xs font-medium",
        STYLES[tone]
      )}
    >
      {LABELS[tone]}
    </span>
  )
}
