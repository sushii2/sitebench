import { z } from "zod"

const aiGatewayConfigSchema = z.object({
  AI_GATEWAY_API_KEY: z
    .string()
    .trim()
    .min(1, "AI_GATEWAY_API_KEY is required"),
})

export type AiGatewayConfig = {
  apiKey: string
}

let cachedConfig: AiGatewayConfig | null = null

export function resolveAiGatewayConfig(
  env?: Record<string, string | undefined>
): AiGatewayConfig {
  const source = env ?? {
    AI_GATEWAY_API_KEY: process.env.AI_GATEWAY_API_KEY,
  }

  const parsed = aiGatewayConfigSchema.safeParse(source)

  if (!parsed.success) {
    throw new Error(
      parsed.error.issues.map((issue) => issue.message).join(". ")
    )
  }

  return {
    apiKey: parsed.data.AI_GATEWAY_API_KEY,
  }
}

export function getAiGatewayConfig() {
  if (!cachedConfig) {
    cachedConfig = resolveAiGatewayConfig()
  }

  return cachedConfig
}
