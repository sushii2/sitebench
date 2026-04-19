import type { SentimentTone } from "@/lib/dashboard/prompts-mock"
import { cn } from "@/lib/utils"

const STYLES: Record<SentimentTone, string> = {
  positive:
    "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  neutral: "bg-muted text-muted-foreground",
  negative: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
}

const LABELS: Record<SentimentTone, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
}

export function SentimentCell({ tone }: { tone: SentimentTone }) {
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
