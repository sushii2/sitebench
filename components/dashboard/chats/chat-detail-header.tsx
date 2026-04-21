"use client"

import Link from "next/link"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import type { ProjectTopic } from "@/lib/project-topics/types"
import type { PromptRun } from "@/lib/prompt-runs/types"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

function formatScheduled(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function ChatDetailHeader({
  backHref,
  promptRun,
  topic,
  trackedPrompt,
}: {
  backHref: string
  promptRun: PromptRun
  topic: ProjectTopic
  trackedPrompt: TrackedPrompt
}) {
  return (
    <div className="flex flex-col gap-3">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <HugeiconsIcon
          icon={ArrowLeft01Icon}
          strokeWidth={2}
          className="size-3.5"
        />
        Back to chats
      </Link>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{topic.name}</Badge>
        <span>Scheduled {formatScheduled(promptRun.scheduled_for)}</span>
      </div>
      <h1 className="text-xl font-semibold tracking-tight">
        {trackedPrompt.prompt_text}
      </h1>
    </div>
  )
}
