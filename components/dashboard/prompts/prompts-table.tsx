"use client"

import * as React from "react"
import { ArrowDown01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { SentimentCell } from "@/components/dashboard/prompts/cells/sentiment-cell"
import { StatusCell } from "@/components/dashboard/prompts/cells/status-cell"
import { TopPerformersCell } from "@/components/dashboard/prompts/cells/top-performers-cell"
import { VisibilityCell } from "@/components/dashboard/prompts/cells/visibility-cell"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BrandCompetitor } from "@/lib/brands/types"
import {
  mockSentiment,
  mockStatusRanAt,
  mockTopPerformerCount,
  mockVisibility,
  type SentimentTone,
} from "@/lib/dashboard/prompts-mock"
import type { ProjectTopic } from "@/lib/project-topics/types"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

const SENTIMENT_RANK: Record<SentimentTone, number> = {
  positive: 2,
  neutral: 1,
  negative: 0,
}

const RANK_TO_SENTIMENT: SentimentTone[] = ["negative", "neutral", "positive"]

function formatCreated(value: string) {
  const created = new Date(value)
  const diffDays = Math.floor((Date.now() - created.getTime()) / 86_400_000)

  if (diffDays < 1) {
    return "today"
  }

  if (diffDays === 1) {
    return "1 day ago"
  }

  if (diffDays < 30) {
    return `${diffDays} days ago`
  }

  return created.toLocaleDateString()
}

function aggregateSentiment(
  prompts: TrackedPrompt[],
  platform: string
): SentimentTone {
  if (prompts.length === 0) {
    return "neutral"
  }

  const total = prompts.reduce(
    (sum, prompt) => sum + SENTIMENT_RANK[mockSentiment(prompt.id, platform)],
    0
  )
  const avg = Math.round(total / prompts.length)

  return RANK_TO_SENTIMENT[Math.min(2, Math.max(0, avg))]
}

function aggregateVisibility(prompts: TrackedPrompt[], platform: string) {
  if (prompts.length === 0) {
    return 0
  }

  const total = prompts.reduce(
    (sum, prompt) => sum + mockVisibility(prompt.id, platform),
    0
  )

  return Math.round(total / prompts.length)
}

function latestRanAt(prompts: TrackedPrompt[]): Date | null {
  if (prompts.length === 0) {
    return null
  }

  return prompts
    .map((prompt) => mockStatusRanAt(prompt.id))
    .reduce((latest, current) => (current > latest ? current : latest))
}

export function PromptsTable({
  topics,
  promptsByTopic,
  competitors,
  platform,
}: {
  topics: ProjectTopic[]
  promptsByTopic: Map<string, TrackedPrompt[]>
  competitors: BrandCompetitor[]
  platform: string
}) {
  const [openTopics, setOpenTopics] = React.useState<Record<string, boolean>>(
    () => Object.fromEntries(topics.map((topic) => [topic.id, true]))
  )

  function toggleTopic(topicId: string) {
    setOpenTopics((current) => ({
      ...current,
      [topicId]: !current[topicId],
    }))
  }

  return (
    <div className="overflow-hidden border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[280px]">Topic</TableHead>
            <TableHead>Avg. Visibility</TableHead>
            <TableHead>Top Performers</TableHead>
            <TableHead>Sentiment</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {topics.map((topic) => {
            const prompts = promptsByTopic.get(topic.id) ?? []
            const isOpen = openTopics[topic.id] !== false
            const visibility = aggregateVisibility(prompts, platform)
            const sentiment = aggregateSentiment(prompts, platform)
            const ranAt = latestRanAt(prompts)
            const performerCount = prompts.length
              ? Math.max(
                  ...prompts.map((prompt) => mockTopPerformerCount(prompt.id))
                )
              : 0

            return (
              <React.Fragment key={topic.id}>
                <TableRow
                  data-state={isOpen ? "open" : "closed"}
                  className="bg-muted/40"
                >
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => toggleTopic(topic.id)}
                      disabled={prompts.length === 0}
                      className="flex items-center gap-2 text-left text-sm font-medium disabled:opacity-50"
                    >
                      <HugeiconsIcon
                        icon={isOpen ? ArrowDown01Icon : ArrowRight01Icon}
                        strokeWidth={2}
                        className="size-3.5 text-muted-foreground"
                      />
                      <span>{topic.name}</span>
                      <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center bg-background px-1.5 text-[11px] tabular-nums text-muted-foreground">
                        {prompts.length}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <VisibilityCell percent={visibility} />
                  </TableCell>
                  <TableCell>
                    <TopPerformersCell
                      competitors={competitors}
                      count={performerCount}
                    />
                  </TableCell>
                  <TableCell>
                    <SentimentCell tone={sentiment} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatCreated(topic.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <StatusCell ranAt={ranAt} />
                  </TableCell>
                </TableRow>
                {isOpen
                  ? prompts.map((prompt) => (
                      <TableRow key={prompt.id}>
                        <TableCell>
                          <div className="pl-7 text-sm">
                            {prompt.prompt_text}
                          </div>
                        </TableCell>
                        <TableCell>
                          <VisibilityCell
                            percent={mockVisibility(prompt.id, platform)}
                          />
                        </TableCell>
                        <TableCell>
                          <TopPerformersCell
                            competitors={competitors}
                            count={mockTopPerformerCount(prompt.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <SentimentCell
                            tone={mockSentiment(prompt.id, platform)}
                          />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatCreated(prompt.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <StatusCell ranAt={mockStatusRanAt(prompt.id)} />
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
              </React.Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
