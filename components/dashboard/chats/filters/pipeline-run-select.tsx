"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PipelineRunBatch } from "@/lib/chats/types"

const ALL_VALUE = "__all__"

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`)

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function PipelineRunSelect({
  batches,
  onChange,
  value,
}: {
  batches: PipelineRunBatch[]
  onChange: (next: string | null) => void
  value: string | null
}) {
  return (
    <Select
      value={value ?? ALL_VALUE}
      onValueChange={(next) => onChange(next === ALL_VALUE ? null : next)}
    >
      <SelectTrigger className="h-9 w-44" aria-label="Pipeline run">
        <SelectValue placeholder="All pipeline runs" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>All pipeline runs</SelectItem>
        {batches.map((batch) => (
          <SelectItem key={batch.date} value={batch.date}>
            {formatDate(batch.date)} · {batch.count}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
