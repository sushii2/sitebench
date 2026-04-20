"use client"

import * as React from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { Tick02Icon } from "@hugeicons/core-free-icons"

import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

export type AnalysisStatus = "idle" | "starting" | "polling" | "completed" | "failed"

type TimelineStepState = "done" | "active" | "upcoming" | "failed"

type TimelineStep = {
  id: string
  title: string
  description: string
  phases: ReadonlyArray<string>
}

const TIMELINE_STEPS: ReadonlyArray<TimelineStep> = [
  {
    id: "scraping",
    title: "Scraping the homepage",
    description: "Reading your website to understand your product.",
    phases: ["scraping"],
  },
  {
    id: "seeding",
    title: "Building the brand profile",
    description: "Turning homepage signals into a structured brand profile.",
    phases: ["seeding", "enhancing"],
  },
  {
    id: "competitors",
    title: "Finding likely competitors",
    description: "Surfacing the companies you are benchmarked against.",
    phases: ["competitors"],
  },
  {
    id: "prompting",
    title: "Generating topics & prompts",
    description: "Drafting the prompts we will use to evaluate your brand.",
    phases: ["prompting"],
  },
]

const PHASE_ORDER = ["scraping", "seeding", "enhancing", "competitors", "prompting", "completed"]

function phaseIndex(phase: string | null | undefined) {
  if (!phase) return -1
  const index = PHASE_ORDER.indexOf(phase)
  return index === -1 ? -1 : index
}

function stepStateFor(
  step: TimelineStep,
  phase: string | null | undefined,
  status: AnalysisStatus
): TimelineStepState {
  if (status === "completed") return "done"
  if (status === "failed") {
    if (!phase || phase === "failed") return "failed"
    const failedIndex = phaseIndex(phase)
    const stepIndex = Math.min(...step.phases.map((p) => phaseIndex(p)))
    if (failedIndex < stepIndex) return "upcoming"
    if (step.phases.includes(phase)) return "failed"
    return "done"
  }

  const currentIndex = phaseIndex(phase ?? "scraping")
  const stepStart = Math.min(...step.phases.map((p) => phaseIndex(p)))
  const stepEnd = Math.max(...step.phases.map((p) => phaseIndex(p)))

  if (currentIndex > stepEnd) return "done"
  if (currentIndex >= stepStart) return "active"
  return "upcoming"
}

type AnalysisTimelineProps = {
  status: AnalysisStatus
  phase: string | null
  className?: string
}

export function AnalysisTimeline({ status, phase, className }: AnalysisTimelineProps) {
  const heading =
    status === "failed"
      ? "Analysis needs manual review"
      : status === "completed"
        ? "Analysis complete"
        : "Analyzing your website"

  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-card px-5 py-5 shadow-xs",
        className
      )}
    >
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="text-sm font-medium text-foreground">{heading}</h3>
        {status === "starting" || status === "polling" ? (
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
            <Spinner className="size-3" />
            Working
          </span>
        ) : null}
      </div>
      <ul className="space-y-5">
        {TIMELINE_STEPS.map((step, index) => {
          const state = stepStateFor(step, phase, status)
          const isLast = index === TIMELINE_STEPS.length - 1

          return (
            <li key={step.id} className="relative flex gap-x-3">
              <div
                className={cn(
                  "absolute top-0 left-0 flex w-6 justify-center",
                  isLast ? "h-6" : "-bottom-5"
                )}
              >
                <span aria-hidden className="w-px bg-border" />
              </div>
              <div className="relative flex size-6 flex-none items-center justify-center bg-card">
                {state === "done" ? (
                  <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <HugeiconsIcon
                      icon={Tick02Icon}
                      strokeWidth={2.5}
                      className="size-3"
                    />
                  </span>
                ) : state === "active" ? (
                  <span className="relative flex size-3 items-center justify-center">
                    <span className="absolute inline-flex size-3 animate-ping rounded-full bg-primary/40" />
                    <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
                  </span>
                ) : state === "failed" ? (
                  <span className="size-2.5 rounded-full bg-destructive ring-4 ring-background" />
                ) : (
                  <span className="size-3 rounded-full border border-border bg-background" />
                )}
              </div>
              <div className="pb-1">
                <p
                  className={cn(
                    "text-sm font-medium leading-5",
                    state === "upcoming"
                      ? "text-muted-foreground"
                      : state === "failed"
                        ? "text-destructive"
                        : "text-foreground"
                  )}
                >
                  {step.title}
                </p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {state === "active"
                    ? "Running now…"
                    : state === "failed"
                      ? "This step failed. Continue manually from the next step."
                      : step.description}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
