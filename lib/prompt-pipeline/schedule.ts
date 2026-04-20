import type { PromptPipelineFrequency } from "@/lib/prompt-pipeline/types"

const DAY_MS = 24 * 60 * 60 * 1000

const frequencyToMs: Record<PromptPipelineFrequency, number> = {
  daily: DAY_MS,
  every_2_days: 2 * DAY_MS,
  every_3_days: 3 * DAY_MS,
  weekly: 7 * DAY_MS,
  every_2_weeks: 14 * DAY_MS,
}

const frequencyLabels: Record<PromptPipelineFrequency, string> = {
  daily: "1 day",
  every_2_days: "2 days",
  every_3_days: "3 days",
  weekly: "1 week",
  every_2_weeks: "2 weeks",
}

export function getPromptPipelineFrequencyLabel(
  frequency: PromptPipelineFrequency
) {
  return frequencyLabels[frequency]
}

export function advancePromptPipelineSchedule(
  scheduledFor: string,
  frequency: PromptPipelineFrequency,
  intervals = 1
) {
  return new Date(
    new Date(scheduledFor).getTime() + frequencyToMs[frequency] * intervals
  ).toISOString()
}

export function computeInitialPromptPipelineRunAt(
  anchorTimestamp: string,
  frequency: PromptPipelineFrequency
) {
  return advancePromptPipelineSchedule(anchorTimestamp, frequency)
}
