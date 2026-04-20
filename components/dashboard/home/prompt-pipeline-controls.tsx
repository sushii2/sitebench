"use client"

import * as React from "react"

import { PromptPipelineConfigDialog } from "@/components/dashboard/home/prompt-pipeline-config-dialog"
import { Button } from "@/components/ui/button"
import {
  fetchPromptPipelineConfig,
  savePromptPipelineConfig,
  startPromptPipelineQuickRun,
  terminatePromptPipelineRun,
} from "@/lib/prompt-pipeline/client"
import type {
  PromptPipelineConfigScreenData,
  PromptPipelineFrequency,
} from "@/lib/prompt-pipeline/types"

export function PromptPipelineControls() {
  const [screenData, setScreenData] =
    React.useState<PromptPipelineConfigScreenData | null>(null)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [noticeMessage, setNoticeMessage] = React.useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(true)
  const [isQuickRunning, setIsQuickRunning] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isTerminating, setIsTerminating] = React.useState(false)

  const refresh = React.useCallback(async (options?: {
    background?: boolean
    preserveNotice?: boolean
  }) => {
    if (!options?.background) {
      setIsLoading(true)
    }

    setErrorMessage(null)
    if (!options?.preserveNotice) {
      setNoticeMessage(null)
    }

    try {
      const result = await fetchPromptPipelineConfig()

      setScreenData(result as PromptPipelineConfigScreenData)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to load the prompt pipeline config."
      )
    } finally {
      if (!options?.background) {
        setIsLoading(false)
      }
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  React.useEffect(() => {
    if (!screenData?.hasActiveRun) {
      return
    }

    const intervalId = window.setInterval(() => {
      void refresh({ background: true })
    }, 3000)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [refresh, screenData?.hasActiveRun])

  async function handleSave(input: {
    frequency: PromptPipelineFrequency
    selectedPromptIds: string[]
  }) {
    setIsSaving(true)
    setErrorMessage(null)
    setNoticeMessage(null)

    try {
      const result = await savePromptPipelineConfig(input)

      setScreenData(result as PromptPipelineConfigScreenData)
      setIsDialogOpen(false)
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save the prompt pipeline config."
      )
    } finally {
      setIsSaving(false)
    }
  }

  async function handleQuickRun() {
    setIsQuickRunning(true)
    setErrorMessage(null)
    setNoticeMessage(null)

    try {
      await startPromptPipelineQuickRun()
      await refresh()
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to start the prompt pipeline quick run."
      )
    } finally {
      setIsQuickRunning(false)
    }
  }

  async function handleTerminateRun() {
    const activeRunId = latestRun?.id

    if (!activeRunId) {
      return
    }

    setIsTerminating(true)
    setErrorMessage(null)
    setNoticeMessage(null)

    try {
      const result = await terminatePromptPipelineRun(activeRunId)

      setScreenData(result as PromptPipelineConfigScreenData)
      setNoticeMessage("Terminated the active run and removed its data.")
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to terminate the prompt pipeline run."
      )
    } finally {
      setIsTerminating(false)
    }
  }

  const latestRun = screenData?.latestRun ?? null
  const hasConfig = Boolean(screenData?.config)
  const hasActivePrompts = (screenData?.activePrompts.length ?? 0) > 0
  const activeRun =
    latestRun?.status === "queued" || latestRun?.status === "running"
      ? latestRun
      : null
  const hasBlockingRun =
    Boolean(activeRun) ||
    (!latestRun && Boolean(screenData?.hasActiveRun))
  const isQuickRunDisabled =
    isLoading ||
    isQuickRunning ||
    isTerminating ||
    !hasConfig ||
    !hasActivePrompts ||
    hasBlockingRun

  const latestRunStatusLabel = (() => {
    if (!latestRun) {
      return null
    }

    switch (latestRun.status) {
      case "queued":
        return "Queued"
      case "running":
        return "Running"
      case "completed":
        return "Completed"
      case "partial":
        return "Partial"
      case "failed":
        return "Failed"
      case "cancelled":
        return "Stopped"
      default:
        return latestRun.status
    }
  })()

  const helperMessage = (() => {
    if (noticeMessage) {
      return noticeMessage
    }

    if (errorMessage) {
      return errorMessage
    }

    if (isLoading) {
      return "Loading prompt pipeline status..."
    }

    if (!hasActivePrompts) {
      return "Add at least one active prompt before running the pipeline."
    }

    if (!hasConfig) {
      return "Quick Run is enabled after you save a prompt pipeline config."
    }

    if (hasBlockingRun) {
      return "Quick Run is disabled while another pipeline run is queued or running."
    }

    if (latestRun?.status === "cancelled") {
      return "Latest pipeline run was stopped. Quick Run is available again."
    }

    if (latestRun?.status === "failed" && latestRun.failure_reason) {
      return latestRun.failure_reason
    }

    return null
  })()

  return (
    <>
      <div className="ml-auto flex max-w-xl flex-col items-end gap-2">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsDialogOpen(true)}
          >
            Configure Prompt Pipeline
          </Button>
          {activeRun ? (
            <Button
              type="button"
              variant="destructive"
              disabled={isLoading || isTerminating}
              onClick={() => {
                void handleTerminateRun()
              }}
            >
              Terminate Run
            </Button>
          ) : (
            <Button
              type="button"
              disabled={Boolean(isQuickRunDisabled)}
              onClick={() => {
                void handleQuickRun()
              }}
            >
              Quick Run
            </Button>
          )}
        </div>
        {helperMessage ? (
          <p
            className="text-right text-xs text-muted-foreground"
            role={errorMessage ? "alert" : "status"}
          >
            {helperMessage}
          </p>
        ) : null}
        {latestRun ? (
          <section className="w-full rounded-md border border-border/60 bg-muted/20 p-3 text-left">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Latest Run
                </p>
                <p className="text-sm font-medium text-foreground">
                  {latestRunStatusLabel}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {latestRun.prompt_count_completed}/{latestRun.prompt_count_total} prompts completed
              </p>
            </div>
            {latestRun.failure_reason ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {latestRun.failure_reason}
              </p>
            ) : null}
            {latestRun.traces.length > 0 ? (
              <ol className="mt-3 flex max-h-48 flex-col gap-2 overflow-y-auto pr-1">
                {latestRun.traces.map((trace) => (
                  <li
                    className="rounded-sm border border-border/50 bg-background/80 px-2 py-1.5 text-xs"
                    key={trace.id}
                  >
                    <p className="font-medium text-foreground">{trace.message}</p>
                    <p className="mt-1 uppercase tracking-[0.15em] text-muted-foreground">
                      {trace.status}
                    </p>
                  </li>
                ))}
              </ol>
            ) : null}
          </section>
        ) : null}
      </div>

      <PromptPipelineConfigDialog
        isSaving={isSaving}
        onOpenChange={setIsDialogOpen}
        onSave={(input) => {
          void handleSave(input)
        }}
        open={isDialogOpen}
        screenData={screenData}
      />
    </>
  )
}
