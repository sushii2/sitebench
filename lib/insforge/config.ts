import { z } from "zod"

const publicConfigSchema = z.object({
  NEXT_PUBLIC_INSFORGE_URL: z
    .string()
    .url("NEXT_PUBLIC_INSFORGE_URL must be a valid URL"),
  NEXT_PUBLIC_INSFORGE_ANON_KEY: z
    .string()
    .trim()
    .min(1, "NEXT_PUBLIC_INSFORGE_ANON_KEY is required"),
})

export type InsforgePublicConfig = {
  anonKey: string
  baseUrl: string
}

export function resolveInsforgePublicConfig(
  env?: Record<string, string | undefined>
): InsforgePublicConfig {
  const source = env ?? {
    NEXT_PUBLIC_INSFORGE_ANON_KEY: process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    NEXT_PUBLIC_INSFORGE_URL: process.env.NEXT_PUBLIC_INSFORGE_URL,
  }

  const parsed = publicConfigSchema.safeParse(source)

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(". ")
    )
  }

  return {
    anonKey: parsed.data.NEXT_PUBLIC_INSFORGE_ANON_KEY,
    baseUrl: parsed.data.NEXT_PUBLIC_INSFORGE_URL,
  }
}
