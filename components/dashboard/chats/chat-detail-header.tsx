"use client"

import Link from "next/link"
import { ArrowLeft01Icon, TimeQuarterPassIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import type { ChatSentimentSummary } from "@/lib/chats/types"
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
  chatSentiment,
  promptRun,
  topic,
  trackedPrompt,
}: {
  backHref: string
  chatSentiment: ChatSentimentSummary | null
  promptRun: PromptRun
  topic: ProjectTopic
  trackedPrompt: TrackedPrompt
}) {
  const sentimentLabel =
    chatSentiment?.label ?
      chatSentiment.label[0].toUpperCase() + chatSentiment.label.slice(1) :
      null

  return (
    <div className="flex flex-col gap-3">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <HugeiconsIcon
          icon={ArrowLeft01Icon}
          strokeWidth={2}
          className="size-3.5"
        />
        Back to chats
      </Link>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="font-normal">
          {topic.name}
        </Badge>
        {sentimentLabel ? (
          <>
            <span aria-hidden>·</span>
            <Badge variant="secondary" className="font-normal">
              {sentimentLabel} sentiment
            </Badge>
          </>
        ) : null}
        <span aria-hidden>·</span>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <HugeiconsIcon
            icon={TimeQuarterPassIcon}
            strokeWidth={2}
            className="size-3"
          />
          {formatScheduled(promptRun.scheduled_for)}
        </span>
      </div>

      <h1 className="text-balance text-2xl font-semibold leading-tight tracking-tight text-foreground">
        {trackedPrompt.prompt_text}
      </h1>
    </div>
  )
}
