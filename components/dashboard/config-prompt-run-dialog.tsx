"use client"

import * as React from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PromptRunConfig } from "@/lib/prompt-run-configs/types"
import type { PromptRunConfigRequest } from "@/lib/prompt-run-configs/schemas"
import type { ProjectTopic } from "@/lib/project-topics/types"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

const PROVIDER_OPTIONS = [
  {
    id: "chatgpt",
    label: "ChatGPT",
  },
  {
    id: "claude",
    label: "Claude",
  },
  {
    id: "perplexity",
    label: "Perplexity",
  },
] as const

type ConfigPromptRunDialogProps = {
  config: PromptRunConfig | null
  isSaving: boolean
  onDisable: () => void
  onOpenChange: (open: boolean) => void
  onSave: (input: PromptRunConfigRequest) => void
  open: boolean
  projectId: string
  prompts: TrackedPrompt[]
  topics: ProjectTopic[]
}

function toDefaultSelection(config: PromptRunConfig | null) {
  return {
    cadenceDays: config?.cadence_days ?? 7,
    enabledProviders: config?.enabled_providers ?? [],
    scheduledRunLocalTime: config?.scheduled_run_local_time ?? "09:00",
    selectedPromptIds: new Set(config?.selected_tracked_prompt_ids ?? []),
  }
}

export function ConfigPromptRunDialog({
  config,
  isSaving,
  onDisable,
  onOpenChange,
  onSave,
  open,
  projectId,
  prompts,
  topics,
}: ConfigPromptRunDialogProps) {
  const [cadenceDays, setCadenceDays] = React.useState<number>(7)
  const [enabledProviders, setEnabledProviders] = React.useState<string[]>([])
  const [scheduledRunLocalTime, setScheduledRunLocalTime] =
    React.useState("09:00")
  const [selectedPromptIds, setSelectedPromptIds] = React.useState<Set<string>>(
    new Set()
  )

  const promptsByTopic = React.useMemo(() => {
    return topics
      .filter((topic) => topic.is_active)
      .map((topic) => ({
        prompts: prompts.filter(
          (prompt) => prompt.is_active && prompt.project_topic_id === topic.id
        ),
        topic,
      }))
      .filter(({ prompts: topicPrompts }) => topicPrompts.length > 0)
  }, [prompts, topics])

  React.useEffect(() => {
    if (!open) {
      return
    }

    const defaults = toDefaultSelection(config)

    setCadenceDays(defaults.cadenceDays)
    setEnabledProviders(defaults.enabledProviders)
    setScheduledRunLocalTime(defaults.scheduledRunLocalTime)
    setSelectedPromptIds(defaults.selectedPromptIds)
  }, [config, open])

  const selectedTopicIds = React.useMemo(() => {
    return [
      ...new Set(
        prompts
          .filter((prompt) => selectedPromptIds.has(prompt.id))
          .map((prompt) => prompt.project_topic_id)
      ),
    ]
  }, [prompts, selectedPromptIds])

  const canSubmit =
    selectedPromptIds.size > 0 &&
    enabledProviders.length > 0 &&
    /^([01]\d|2[0-3]):[0-5]\d$/.test(scheduledRunLocalTime)

  function toggleProvider(providerId: string, checked: boolean) {
    setEnabledProviders((current) => {
      const next = new Set(current)

      if (checked) {
        next.add(providerId)
      } else {
        next.delete(providerId)
      }

      return [...next]
    })
  }

  function toggleTopic(topicId: string, checked: boolean) {
    const topicPromptIds = prompts
      .filter((prompt) => prompt.project_topic_id === topicId && prompt.is_active)
      .map((prompt) => prompt.id)

    setSelectedPromptIds((current) => {
      const next = new Set(current)

      for (const promptId of topicPromptIds) {
        if (checked) {
          next.add(promptId)
        } else {
          next.delete(promptId)
        }
      }

      return next
    })
  }

  function togglePrompt(promptId: string, checked: boolean) {
    setSelectedPromptIds((current) => {
      const next = new Set(current)

      if (checked) {
        next.add(promptId)
      } else {
        next.delete(promptId)
      }

      return next
    })
  }

  function handleSubmit() {
    if (!canSubmit) {
      return
    }

    onSave({
      cadenceDays: cadenceDays as 1 | 2 | 3 | 7,
      enabledProviders: enabledProviders as Array<
        "chatgpt" | "claude" | "perplexity"
      >,
      isEnabled: true,
      projectId,
      scheduledRunLocalTime,
      selectedProjectTopicIds: selectedTopicIds,
      selectedTrackedPromptIds: [...selectedPromptIds],
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] gap-5 overflow-y-auto p-6 text-sm sm:max-w-3xl">
        <DialogHeader className="gap-2">
          <DialogTitle className="font-heading text-lg font-medium">
            Config Prompt Run
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Pick the prompts, providers, and cadence the dashboard should run on
            your behalf.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
          <div className="space-y-4">
            <Card size="sm" className="gap-3">
              <CardHeader className="border-b">
                <CardTitle>Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="prompt-run-cadence">Cadence</Label>
                  <Select
                    value={String(cadenceDays)}
                    onValueChange={(value) => setCadenceDays(Number(value))}
                  >
                    <SelectTrigger id="prompt-run-cadence">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Every day</SelectItem>
                      <SelectItem value="2">Every 2 days</SelectItem>
                      <SelectItem value="3">Every 3 days</SelectItem>
                      <SelectItem value="7">Every 7 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prompt-run-time">Local time</Label>
                  <Input
                    id="prompt-run-time"
                    type="time"
                    value={scheduledRunLocalTime}
                    onChange={(event) =>
                      setScheduledRunLocalTime(event.target.value)
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card size="sm" className="gap-3">
              <CardHeader className="border-b">
                <CardTitle>Providers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {PROVIDER_OPTIONS.map((provider) => {
                  const checked = enabledProviders.includes(provider.id)

                  return (
                    <label
                      key={provider.id}
                      className="flex items-center gap-2 text-xs"
                    >
                      <input
                        checked={checked}
                        type="checkbox"
                        onChange={(event) =>
                          toggleProvider(provider.id, event.target.checked)
                        }
                      />
                      <span>{provider.label}</span>
                    </label>
                  )
                })}
              </CardContent>
            </Card>
          </div>

          <Card size="sm" className="gap-3">
            <CardHeader className="border-b">
              <CardTitle>Topics and prompts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {promptsByTopic.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Add tracked prompts first to configure scheduled runs.
                </p>
              ) : (
                promptsByTopic.map(({ prompts: topicPrompts, topic }) => {
                  const topicSelected = topicPrompts.every((prompt) =>
                    selectedPromptIds.has(prompt.id)
                  )

                  return (
                    <div key={topic.id} className="space-y-2 border-b pb-4 last:border-b-0">
                      <label className="flex items-center gap-2 text-xs font-medium">
                        <input
                          checked={topicSelected}
                          type="checkbox"
                          onChange={(event) =>
                            toggleTopic(topic.id, event.target.checked)
                          }
                        />
                        <span>{topic.name}</span>
                      </label>
                      <div className="space-y-2 pl-5">
                        {topicPrompts.map((prompt) => (
                          <label
                            key={prompt.id}
                            className="flex items-start gap-2 text-xs text-muted-foreground"
                          >
                            <input
                              checked={selectedPromptIds.has(prompt.id)}
                              type="checkbox"
                              onChange={(event) =>
                                togglePrompt(prompt.id, event.target.checked)
                              }
                            />
                            <span>{prompt.prompt_text}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter className="justify-between">
          <div className="flex items-center gap-2">
            {config ? (
              <Button
                type="button"
                variant="outline"
                onClick={onDisable}
                disabled={isSaving}
              >
                Disable schedule
              </Button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={!canSubmit || isSaving}>
              {isSaving ? "Saving..." : "Save configuration"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
