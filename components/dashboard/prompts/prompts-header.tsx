"use client"

import { Add01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { NextRunTimer } from "@/components/dashboard/prompts/next-run-timer"
import { Button } from "@/components/ui/button"

export function PromptsHeader({
  nextRunAt,
  onAddPrompt,
  onEditSchedule,
}: {
  nextRunAt: Date
  onAddPrompt: () => void
  onEditSchedule: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">Prompts</h1>
      <div className="flex items-center gap-3">
        <NextRunTimer target={nextRunAt} />
        <Button type="button" variant="outline" size="sm" onClick={onEditSchedule}>
          Edit
        </Button>
        <Button type="button" size="sm" onClick={onAddPrompt}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
          Add Prompt
        </Button>
      </div>
    </div>
  )
}
