import { z } from "zod"

import {
  promptRunCadenceDays,
  promptRunProviderIds,
} from "@/lib/prompt-run-configs/types"

const promptRunProviderSchema = z.enum(promptRunProviderIds)
const promptRunCadenceSchema = z.union(
  promptRunCadenceDays.map((cadence) => z.literal(cadence)) as [
    z.ZodLiteral<1>,
    z.ZodLiteral<2>,
    z.ZodLiteral<3>,
    z.ZodLiteral<7>,
  ]
)

const promptRunIdSchema = z.string().uuid("A valid UUID is required.")

export const promptRunLocalTimeSchema = z
  .string()
  .regex(
    /^([01]\d|2[0-3]):[0-5]\d$/,
    "Scheduled run time must use HH:MM 24-hour format."
  )

export const promptRunConfigRequestSchema = z.object({
  cadenceDays: promptRunCadenceSchema,
  enabledProviders: z
    .array(promptRunProviderSchema)
    .min(1, "Select at least one provider."),
  isEnabled: z.boolean().default(true),
  projectId: promptRunIdSchema,
  scheduledRunLocalTime: promptRunLocalTimeSchema,
  selectedProjectTopicIds: z
    .array(promptRunIdSchema)
    .min(1, "Select at least one topic."),
  selectedTrackedPromptIds: z
    .array(promptRunIdSchema)
    .min(1, "Select at least one prompt."),
})

const promptRunTimestampSchema = z.string().datetime({ offset: true })

export const promptRunConfigSchema = z.object({
  cadence_days: promptRunCadenceSchema,
  claimed_at: promptRunTimestampSchema.nullable(),
  created_at: promptRunTimestampSchema,
  current_run_id: z.string().nullable(),
  enabled_providers: z.array(promptRunProviderSchema),
  id: promptRunIdSchema,
  is_enabled: z.boolean(),
  last_run_at: promptRunTimestampSchema.nullable(),
  next_run_at: promptRunTimestampSchema.nullable(),
  project_id: promptRunIdSchema,
  scheduled_run_local_time: promptRunLocalTimeSchema,
  selected_project_topic_ids: z.array(promptRunIdSchema),
  selected_tracked_prompt_ids: z.array(promptRunIdSchema),
  updated_at: promptRunTimestampSchema,
})

export const promptRunTriggerRequestSchema = z.object({
  projectId: promptRunIdSchema,
})

export const promptRunConfigQuerySchema = z.object({
  projectId: promptRunIdSchema,
})

export const promptRunConfigResponseSchema = z.object({
  config: promptRunConfigSchema,
})

export const promptRunTriggerResponseSchema = z.object({
  publicAccessToken: z.string().trim().min(1),
  runId: z.string().trim().min(1),
})

export type PromptRunConfigRequest = z.infer<
  typeof promptRunConfigRequestSchema
>
export type PromptRunTriggerRequest = z.infer<
  typeof promptRunTriggerRequestSchema
>
