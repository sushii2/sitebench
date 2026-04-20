"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Calendar03Icon, Clock01Icon } from "@hugeicons/core-free-icons"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"
import { getPromptPipelineFrequencyLabel } from "@/lib/prompt-pipeline/schedule"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"
import type {
  PromptPipelineConfigScreenData,
  PromptPipelineFrequency,
} from "@/lib/prompt-pipeline/types"

const FREQUENCIES: PromptPipelineFrequency[] = [
  "daily",
  "every_2_days",
  "every_3_days",
  "weekly",
  "every_2_weeks",
]

const SECTION_LABEL_CLASS =
  "text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"

function formatPreview(value: string | null, timeZone: string) {
  if (!value) {
    return "Not scheduled"
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value))
}

export function PromptPipelineConfigDialog({
  isSaving,
  onOpenChange,
  onSave,
  open,
  screenData,
}: {
  isSaving: boolean
  onOpenChange: (open: boolean) => void
  onSave: (input: {
    frequency: PromptPipelineFrequency
    selectedPromptIds: string[]
  }) => void
  open: boolean
  screenData: PromptPipelineConfigScreenData | null
}) {
  const groupedPrompts = React.useMemo(() => {
    const promptsByTopicId = new Map<string, TrackedPrompt[]>()

    for (const prompt of screenData?.activePrompts ?? []) {
      const list = promptsByTopicId.get(prompt.project_topic_id) ?? []

      list.push(prompt)
      promptsByTopicId.set(prompt.project_topic_id, list)
    }

    return promptsByTopicId
  }, [screenData])

  const [frequency, setFrequency] = React.useState<PromptPipelineFrequency>(
    screenData?.config?.frequency ?? "weekly"
  )
  const [selectedPromptIds, setSelectedPromptIds] = React.useState<string[]>(
    screenData?.config?.selected_prompt_ids ??
      screenData?.activePrompts.map((prompt) => prompt.id) ??
      []
  )
  const [defaultPreviewTimestamp] = React.useState(() =>
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  )

  React.useEffect(() => {
    setFrequency(screenData?.config?.frequency ?? "weekly")
    setSelectedPromptIds(
      screenData?.config?.selected_prompt_ids ??
        screenData?.activePrompts.map((prompt) => prompt.id) ??
        []
    )
  }, [screenData])

  const previewTimestamp = React.useMemo(() => {
    const nextRunAt = screenData?.config?.next_run_at

    if (nextRunAt) {
      return nextRunAt
    }

    return defaultPreviewTimestamp
  }, [defaultPreviewTimestamp, screenData?.config?.next_run_at])

  const totalPromptCount = screenData?.activePrompts.length ?? 0
  const selectedCount = selectedPromptIds.length
  const allSelected =
    totalPromptCount > 0 && selectedCount === totalPromptCount
  const activeTopics = screenData?.activeTopics ?? []

  function togglePrompt(promptId: string) {
    setSelectedPromptIds((current) =>
      current.includes(promptId)
        ? current.filter((id) => id !== promptId)
        : [...current, promptId]
    )
  }

  function toggleTopicPromptSelection(
    topicPromptIds: string[],
    topicSelected: boolean
  ) {
    setSelectedPromptIds((current) => {
      if (topicSelected) {
        return current.filter((promptId) => !topicPromptIds.includes(promptId))
      }

      return [...new Set([...current, ...topicPromptIds])]
    })
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedPromptIds([])
      return
    }

    setSelectedPromptIds(
      (screenData?.activePrompts ?? []).map((prompt) => prompt.id)
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 p-0 sm:max-w-xl">
        <DialogHeader className="gap-1 border-b border-border px-5 py-4">
          <DialogTitle>Configure Prompt Pipeline</DialogTitle>
          <DialogDescription>
            Pick a cadence and the saved prompts you want to re-run on
            schedule.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 px-5 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="prompt-pipeline-frequency" className={SECTION_LABEL_CLASS}>
              <HugeiconsIcon
                icon={Calendar03Icon}
                strokeWidth={2}
                className="size-3.5"
              />
              Frequency
            </Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <Select
                value={frequency}
                onValueChange={(value) =>
                  setFrequency(value as PromptPipelineFrequency)
                }
              >
                <SelectTrigger
                  id="prompt-pipeline-frequency"
                  className="w-full sm:w-48"
                >
                  <SelectValue placeholder="Select a cadence" />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map((option) => (
                    <SelectItem key={option} value={option}>
                      Every {getPromptPipelineFrequencyLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <HugeiconsIcon
                  icon={Clock01Icon}
                  strokeWidth={2}
                  className="size-3.5"
                />
                Next run{" "}
                <span className="font-medium text-foreground">
                  {formatPreview(
                    previewTimestamp,
                    screenData?.reportingTimezone ?? "UTC"
                  )}
                </span>
              </p>
            </div>
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <span className={SECTION_LABEL_CLASS}>Prompts</span>
            {totalPromptCount > 0 ? (
              <div className="flex items-center gap-3">
                <span className="text-[11px] text-muted-foreground">
                  {selectedCount} of {totalPromptCount} selected
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={toggleSelectAll}
                >
                  {allSelected ? "Clear all" : "Select all"}
                </Button>
              </div>
            ) : null}
          </div>

          {totalPromptCount === 0 ? (
            <div className="border border-dashed border-border px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">
                No active prompts yet. Add prompts to include them in the
                pipeline.
              </p>
            </div>
          ) : (
            <div className="flex max-h-[340px] flex-col gap-3 overflow-y-auto pr-1">
              {activeTopics.map((topic) => {
                const prompts = groupedPrompts.get(topic.id) ?? []

                if (prompts.length === 0) {
                  return null
                }

                const topicPromptIds = prompts.map((prompt) => prompt.id)
                const selectedInTopic = topicPromptIds.filter((id) =>
                  selectedPromptIds.includes(id)
                ).length
                const topicSelected =
                  selectedInTopic === topicPromptIds.length
                const topicIndeterminate =
                  selectedInTopic > 0 && !topicSelected

                return (
                  <section
                    key={topic.id}
                    className="border border-border bg-background/60"
                  >
                    <Label
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-3 border-b border-border bg-muted/30 px-3 py-2 text-xs font-medium hover:bg-muted/60",
                        topicSelected && "bg-muted/60"
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <Checkbox
                          checked={
                            topicIndeterminate ? "indeterminate" : topicSelected
                          }
                          onCheckedChange={() =>
                            toggleTopicPromptSelection(
                              topicPromptIds,
                              topicSelected
                            )
                          }
                        />
                        <span>{topic.name}</span>
                      </span>
                      <span className="text-[11px] font-normal text-muted-foreground">
                        {selectedInTopic}/{topicPromptIds.length}
                      </span>
                    </Label>
                    <ul className="flex flex-col">
                      {prompts.map((prompt, index) => {
                        const checked = selectedPromptIds.includes(prompt.id)

                        return (
                          <li
                            key={prompt.id}
                            className={cn(
                              "flex",
                              index > 0 && "border-t border-border"
                            )}
                          >
                            <Label className="flex w-full cursor-pointer items-start gap-2.5 px-3 py-2.5 text-xs leading-snug hover:bg-muted/30">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={() =>
                                  togglePrompt(prompt.id)
                                }
                                className="mt-px"
                              />
                              <span
                                className={cn(
                                  "flex-1 text-left",
                                  checked
                                    ? "text-foreground"
                                    : "text-muted-foreground"
                                )}
                              >
                                {prompt.prompt_text}
                              </span>
                            </Label>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                )
              })}
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-border px-5 py-3">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button
            type="button"
            disabled={isSaving || selectedCount === 0}
            onClick={() =>
              onSave({
                frequency,
                selectedPromptIds,
              })
            }
          >
            {isSaving ? "Saving…" : "Save config"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
