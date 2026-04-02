import { z } from "zod"

const publicConfigSchema = z.object({
  NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY: z
    .string()
    .trim()
    .min(1, "NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY is required"),
})

export type LogoDevPublicConfig = {
  publishableKey: string
}

export function resolveLogoDevPublicConfig(
  env?: Record<string, string | undefined>
): LogoDevPublicConfig {
  const source = env ?? {
    NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY,
  }

  const parsed = publicConfigSchema.safeParse(source)

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(". ")
    )
  }

  return {
    publishableKey: parsed.data.NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY,
  }
}
