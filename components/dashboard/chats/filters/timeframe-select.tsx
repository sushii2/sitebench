"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ChatTimeframe } from "@/lib/chats/filters"

const ALL_VALUE = "__all__"
const OPTIONS: Array<{ label: string; value: ChatTimeframe }> = [
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
]

export function TimeframeSelect({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean
  onChange: (next: ChatTimeframe | null) => void
  value: ChatTimeframe | null
}) {
  return (
    <Select
      disabled={disabled}
      value={value ?? ALL_VALUE}
      onValueChange={(next) =>
        onChange(next === ALL_VALUE ? null : (next as ChatTimeframe))
      }
    >
      <SelectTrigger className="h-9 w-40" aria-label="Time frame">
        <SelectValue placeholder="All time" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>All time</SelectItem>
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
