"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import {
  Add01Icon,
  ArrowDown01Icon,
  ArrowRight01Icon,
  Cancel01Icon,
  Delete02Icon,
  Edit02Icon,
  Tick02Icon,
} from "@hugeicons/core-free-icons"

import type { OnboardingPromptDraft, OnboardingTopicDraft } from "@/lib/onboarding/types"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type TopicRowDraft = Omit<OnboardingTopicDraft, "prompts"> & {
  id: string
  prompts: Array<OnboardingPromptDraft & { id: string }>
}

type IntentValue = NonNullable<OnboardingPromptDraft["intent"]> | "all"
type SourceValue = OnboardingTopicDraft["source"] | "all"

type TopicsPromptsTableProps = {
  topics: TopicRowDraft[]
  search: string
  onSearchChange: (value: string) => void
  intentFilter: IntentValue
  onIntentFilterChange: (value: IntentValue) => void
  sourceFilter: SourceValue
  onSourceFilterChange: (value: SourceValue) => void
  openTopicIds: ReadonlySet<string>
  onToggleTopic: (topicId: string, open: boolean) => void
  editingTopicId: string | null
  topicEditValue: string
  onTopicEditChange: (value: string) => void
  onStartEditTopic: (topic: TopicRowDraft) => void
  onCommitEditTopic: (topicId: string) => void
  onCancelEditTopic: () => void
  onRemoveTopic: (topic: TopicRowDraft) => void
  onAddPrompt: (topic: TopicRowDraft) => void
  onEditPrompt: (topic: TopicRowDraft, prompt: TopicRowDraft["prompts"][number]) => void
  onRemovePrompt: (
    topic: TopicRowDraft,
    prompt: TopicRowDraft["prompts"][number],
    index: number
  ) => void
  topicPromptErrors: Record<string, string | undefined>
  totalTopicCount: number
  catalogTopicCount?: number
  isRefreshing?: boolean
}

const INTENT_OPTIONS: Array<{ value: IntentValue; label: string }> = [
  { value: "all", label: "All intents" },
  { value: "brand_aware", label: "Brand aware" },
  { value: "comparison", label: "Comparison" },
  { value: "constraint_based", label: "Constraint based" },
  { value: "follow_up", label: "Follow up" },
  { value: "informational", label: "Informational" },
  { value: "local", label: "Local" },
  { value: "recommendation", label: "Recommendation" },
  { value: "reputational", label: "Reputational" },
  { value: "transactional", label: "Transactional" },
]

const SOURCE_OPTIONS: Array<{ value: SourceValue; label: string }> = [
  { value: "all", label: "All sources" },
  { value: "ai_suggested", label: "AI suggested" },
  { value: "user_added", label: "Custom" },
  { value: "system_seeded", label: "Seeded" },
]

function sourceLabel(source: OnboardingTopicDraft["source"]) {
  if (source === "ai_suggested") return "AI suggested"
  if (source === "user_added") return "Custom"
  return "Seeded"
}

function formatIntent(intent: OnboardingPromptDraft["intent"]) {
  return intent ? intent.replace(/_/g, " ") : "custom"
}

export function TopicsPromptsTable(props: TopicsPromptsTableProps) {
  const {
    topics,
    search,
    onSearchChange,
    intentFilter,
    onIntentFilterChange,
    sourceFilter,
    onSourceFilterChange,
    openTopicIds,
    onToggleTopic,
    editingTopicId,
    topicEditValue,
    onTopicEditChange,
    onStartEditTopic,
    onCommitEditTopic,
    onCancelEditTopic,
    onRemoveTopic,
    onAddPrompt,
    onEditPrompt,
    onRemovePrompt,
    topicPromptErrors,
    totalTopicCount,
    catalogTopicCount,
    isRefreshing,
  } = props

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Search topics and prompts"
            placeholder="Search prompts, topics, descriptions"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            className="h-8 w-full sm:w-72"
          />
          <select
            aria-label="Filter by intent"
            value={intentFilter}
            onChange={(event) => onIntentFilterChange(event.target.value as IntentValue)}
            className={cn(
              "h-8 rounded-md border border-input bg-transparent px-2 text-xs",
              "focus:outline-none focus:ring-1 focus:ring-ring"
            )}
          >
            {INTENT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter by source"
            value={sourceFilter}
            onChange={(event) => onSourceFilterChange(event.target.value as SourceValue)}
            className={cn(
              "h-8 rounded-md border border-input bg-transparent px-2 text-xs",
              "focus:outline-none focus:ring-1 focus:ring-ring"
            )}
          >
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <p className="text-xs text-muted-foreground">
          {topics.length} of {totalTopicCount} topics
          {typeof catalogTopicCount === "number"
            ? ` · catalog has ${catalogTopicCount}`
            : ""}
          {isRefreshing ? " · refreshing…" : ""}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <Table>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-8" />
              <TableHead className="min-w-[220px]">Topic</TableHead>
              <TableHead className="w-24">Prompts</TableHead>
              <TableHead className="w-28">Source</TableHead>
              <TableHead className="w-20 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topics.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={5}
                  className="h-24 text-center text-muted-foreground"
                >
                  {totalTopicCount === 0
                    ? "No topics yet. Add at least 3 to continue."
                    : "No topics match the current filters."}
                </TableCell>
              </TableRow>
            ) : (
              topics.map((topic) => {
                const isOpen = openTopicIds.has(topic.id)
                const isEditing = editingTopicId === topic.id
                const rowError = topicPromptErrors[topic.id]

                return (
                  <React.Fragment key={topic.id}>
                    <TableRow
                      aria-expanded={isOpen}
                      className="cursor-pointer"
                      onClick={() => onToggleTopic(topic.id, !isOpen)}
                    >
                      <TableCell className="w-8 pl-3 text-muted-foreground">
                        <HugeiconsIcon
                          icon={isOpen ? ArrowDown01Icon : ArrowRight01Icon}
                          className="size-4"
                        />
                      </TableCell>
                      <TableCell className="min-w-[220px] whitespace-normal">
                        {isEditing ? (
                          <div
                            className="flex items-center gap-2"
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Input
                              autoFocus
                              value={topicEditValue}
                              onChange={(event) => onTopicEditChange(event.target.value)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault()
                                  onCommitEditTopic(topic.id)
                                }
                                if (event.key === "Escape") {
                                  event.preventDefault()
                                  onCancelEditTopic()
                                }
                              }}
                              onBlur={() => onCommitEditTopic(topic.id)}
                              className="h-8"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label="Cancel topic edit"
                              onMouseDown={(event) => {
                                event.preventDefault()
                                onCancelEditTopic()
                              }}
                            >
                              <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium text-foreground">
                              {topic.topicName}
                            </span>
                            {topic.topicDescription ? (
                              <span className="text-xs text-muted-foreground line-clamp-2">
                                {topic.topicDescription}
                              </span>
                            ) : null}
                            {rowError ? (
                              <span className="text-xs text-destructive">
                                {rowError}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="w-24">
                        <Badge variant="outline" className="font-normal">
                          {topic.prompts.length}
                        </Badge>
                      </TableCell>
                      <TableCell className="w-28">
                        <Badge variant="outline" className="font-normal">
                          {sourceLabel(topic.source)}
                        </Badge>
                      </TableCell>
                      <TableCell
                        className="w-20 pr-3 text-right"
                        onClick={(event) => event.stopPropagation()}
                      >
                        <div className="flex justify-end gap-0.5">
                          {isEditing ? (
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label="Save topic name"
                              onClick={() => onCommitEditTopic(topic.id)}
                            >
                              <HugeiconsIcon icon={Tick02Icon} className="size-4" />
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Edit topic ${topic.topicName}`}
                              onClick={() => onStartEditTopic(topic)}
                            >
                              <HugeiconsIcon icon={Edit02Icon} className="size-4" />
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Remove topic ${topic.topicName}`}
                            onClick={() => onRemoveTopic(topic)}
                          >
                            <HugeiconsIcon icon={Delete02Icon} className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>

                    {isOpen ? (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell />
                        <TableCell colSpan={4} className="whitespace-normal py-3">
                          <div className="flex flex-col gap-2">
                            {topic.prompts.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                No prompts yet. Refresh the catalog or add one.
                              </p>
                            ) : (
                              topic.prompts.map((prompt, promptIndex) => (
                                <div
                                  key={prompt.id}
                                  className="flex items-start justify-between gap-3 rounded-md border border-border/60 bg-background px-3 py-2"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex flex-wrap gap-1.5">
                                      <Badge
                                        variant="outline"
                                        className="font-normal"
                                      >
                                        #{promptIndex + 1}
                                      </Badge>
                                      <Badge
                                        variant="outline"
                                        className="font-normal capitalize"
                                      >
                                        {formatIntent(prompt.intent)}
                                      </Badge>
                                      <Badge
                                        variant="outline"
                                        className="font-normal"
                                      >
                                        {prompt.addedVia === "user_created"
                                          ? "Custom"
                                          : "AI"}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-foreground line-clamp-3">
                                      {prompt.promptText || (
                                        <span className="italic text-muted-foreground">
                                          Empty prompt
                                        </span>
                                      )}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center gap-0.5">
                                    <Button
                                      type="button"
                                      size="icon-sm"
                                      variant="ghost"
                                      aria-label={`Edit prompt ${promptIndex + 1}`}
                                      onClick={() => onEditPrompt(topic, prompt)}
                                    >
                                      <HugeiconsIcon
                                        icon={Edit02Icon}
                                        className="size-4"
                                      />
                                    </Button>
                                    <Button
                                      type="button"
                                      size="icon-sm"
                                      variant="ghost"
                                      aria-label={`Remove prompt ${promptIndex + 1}`}
                                      onClick={() =>
                                        onRemovePrompt(topic, prompt, promptIndex)
                                      }
                                    >
                                      <HugeiconsIcon
                                        icon={Delete02Icon}
                                        className="size-4"
                                      />
                                    </Button>
                                  </div>
                                </div>
                              ))
                            )}

                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="self-start"
                              onClick={() => onAddPrompt(topic)}
                            >
                              <HugeiconsIcon icon={Add01Icon} className="size-4" />
                              Add prompt
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </React.Fragment>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
