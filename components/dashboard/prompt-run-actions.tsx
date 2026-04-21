"use client"

import * as React from "react"
import { toast } from "sonner"
import { useRealtimeRun } from "@trigger.dev/react-hooks"

import { useAuth } from "@/components/auth-provider"
import { ConfigPromptRunDialog } from "@/components/dashboard/config-prompt-run-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  disablePromptRunSchedule,
  fetchPromptRunConfig,
  savePromptRunConfig,
  triggerPromptRun,
} from "@/lib/prompt-run-configs/client"
import type { PromptRunConfigRequest } from "@/lib/prompt-run-configs/schemas"
import type { PromptRunConfig } from "@/lib/prompt-run-configs/types"
import { getInsforgeBrowserClient } from "@/lib/insforge/browser-client"
import { loadProjectTopics } from "@/lib/project-topics/repository"
import type { ProjectTopic } from "@/lib/project-topics/types"
import { loadTrackedPromptsByProject } from "@/lib/tracked-prompts/repository"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

function formatDateTime(value: string | null) {
  if (!value) {
    return "Not scheduled"
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "Not scheduled"
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)
}

function formatCadence(config: PromptRunConfig | null) {
  if (!config) {
    return "No saved run configuration yet."
  }

  const cadenceLabel =
    config.cadence_days === 1
      ? "Every day"
      : `Every ${config.cadence_days} days`

  return `${cadenceLabel} at ${config.scheduled_run_local_time}`
}

function getProgressPhase(run: {
  metadata?: unknown
  status?: string
} | undefined) {
  const metadataValue =
    typeof run?.metadata === "object" && run.metadata !== null
      ? (run.metadata as { progress?: { phase?: string } })
      : null

  return metadataValue?.progress?.phase ?? run?.status ?? null
}

type PromptRunRealtimeSubscriberProps = {
  accessToken: string
  onComplete: () => void
  onUpdate: (phase: string | null, error: Error | null) => void
  runId: string
}

function PromptRunRealtimeSubscriber({
  accessToken,
  onComplete,
  onUpdate,
  runId,
}: PromptRunRealtimeSubscriberProps) {
  const { error, run } = useRealtimeRun(runId, {
    accessToken,
    onComplete,
  })

  React.useEffect(() => {
    onUpdate(getProgressPhase(run), error ?? null)
  }, [error, onUpdate, run])

  return null
}

export function PromptRunActions() {
  const { brand } = useAuth()
  const projectId = brand?.id ?? null
  const [config, setConfig] = React.useState<PromptRunConfig | null>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isTriggering, setIsTriggering] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [topics, setTopics] = React.useState<ProjectTopic[]>([])
  const [prompts, setPrompts] = React.useState<TrackedPrompt[]>([])
  const [activeRun, setActiveRun] = React.useState<{
    publicAccessToken: string
    runId: string
  } | null>(null)
  const [phase, setPhase] = React.useState<string | null>(null)
  const [realtimeError, setRealtimeError] = React.useState<string | null>(null)

  const reloadData = React.useEffectEvent(async () => {
    if (!projectId) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const client = getInsforgeBrowserClient()
      const [loadedTopics, loadedPrompts, loadedConfig] = await Promise.all([
        loadProjectTopics(client, projectId),
        loadTrackedPromptsByProject(client, projectId),
        fetchPromptRunConfig(projectId),
      ])

      setTopics(loadedTopics)
      setPrompts(loadedPrompts)
      setConfig(loadedConfig)
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load prompt run settings."
      )
    } finally {
      setIsLoading(false)
    }
  })

  const handleRunComplete = React.useCallback(() => {
    setIsTriggering(false)
    setActiveRun(null)
    setPhase(null)
    void reloadData()
  }, [])

  const handleRunUpdate = React.useCallback(
    (nextPhase: string | null, nextError: Error | null) => {
      setPhase(nextPhase)
      setRealtimeError(nextError?.message ?? null)
    },
    []
  )

  React.useEffect(() => {
    void reloadData()
  }, [projectId])

  async function handleSave(input: PromptRunConfigRequest) {
    setIsSaving(true)

    try {
      const savedConfig = await savePromptRunConfig(input)

      setConfig(savedConfig)
      setIsDialogOpen(false)
      toast.success("Prompt run configuration saved.")
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Unable to save prompt run settings."
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDisable() {
    if (!projectId) {
      return
    }

    setIsSaving(true)

    try {
      const disabledConfig = await disablePromptRunSchedule(projectId)

      setConfig(disabledConfig)
      setIsDialogOpen(false)
      toast.success("Scheduled prompt runs disabled.")
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Unable to disable prompt run settings."
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleQuickRun() {
    if (!projectId || !config?.is_enabled) {
      return
    }

    setIsTriggering(true)

    try {
      const nextRun = await triggerPromptRun({
        projectId,
      })

      setActiveRun(nextRun)
      toast.success("Prompt run started.")
    } catch (caught) {
      setIsTriggering(false)
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Unable to start the prompt run."
      )
    }
  }

  if (!projectId) {
    return null
  }

  const quickRunDisabled =
    isLoading || isTriggering || !config || !config.is_enabled

  return (
    <>
      {activeRun ? (
        <PromptRunRealtimeSubscriber
          accessToken={activeRun.publicAccessToken}
          onComplete={handleRunComplete}
          onUpdate={handleRunUpdate}
          runId={activeRun.runId}
        />
      ) : null}
      <Card className="gap-4 border border-border/80">
        <CardHeader className="border-b">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <CardTitle>Configured Prompt Runs</CardTitle>
              <p className="text-xs text-muted-foreground">
                {formatCadence(config)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(true)}
              >
                Config Prompt Run
              </Button>
              <Button
                type="button"
                onClick={handleQuickRun}
                disabled={quickRunDisabled}
              >
                {isTriggering ? "Running..." : "Quick Run"}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 pt-4 lg:grid-cols-[1fr_auto] lg:items-start">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Next run
              </p>
              <p>{formatDateTime(config?.next_run_at ?? null)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Last run
              </p>
              <p>{formatDateTime(config?.last_run_at ?? null)}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Selection
              </p>
              <p>
                {config
                  ? `${config.selected_project_topic_ids.length} topics, ${config.selected_tracked_prompt_ids.length} prompts`
                  : "Not configured"}
              </p>
            </div>
          </div>

          <div className="flex flex-col items-start gap-2">
            <Badge variant={config?.is_enabled ? "secondary" : "outline"}>
              {config?.is_enabled ? "Scheduled" : "Disabled"}
            </Badge>
            {phase ? (
              <Badge variant="outline">Run phase: {phase}</Badge>
            ) : null}
          </div>
        </CardContent>
        {error || realtimeError ? (
          <CardContent className="pt-0">
            <p className="text-xs text-destructive">
              {error ?? realtimeError}
            </p>
          </CardContent>
        ) : null}
      </Card>

      <ConfigPromptRunDialog
        config={config}
        isSaving={isSaving}
        onDisable={handleDisable}
        onOpenChange={setIsDialogOpen}
        onSave={handleSave}
        open={isDialogOpen}
        projectId={projectId}
        prompts={prompts}
        topics={topics}
      />
    </>
  )
}
