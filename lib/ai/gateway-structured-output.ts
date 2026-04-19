import { Output, type FlexibleSchema } from "ai"

// Based on Vercel AI Gateway structured-output docs and OpenAI strict schema rules:
// https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-compat/structured-outputs
export const AI_GATEWAY_STRUCTURED_OUTPUT_DOCS_URL =
  "https://vercel.com/docs/ai-gateway/sdks-and-apis/openai-compat/structured-outputs"

const AI_GATEWAY_STRUCTURED_OUTPUT_RULES = [
  "AI Gateway structured-output contract:",
  "Return exactly one JSON object that matches the provided schema.",
  "Never omit a schema key.",
  "Never add an extra key.",
  "If evidence is missing, use the empty value allowed by the schema such as an empty string, empty array, or null only when null is allowed.",
  "Do not wrap the JSON in markdown, prose, commentary, or code fences.",
]

export function buildGatewayStructuredOutputSystemPrompt(
  instructions: string[]
) {
  return [...instructions, ...AI_GATEWAY_STRUCTURED_OUTPUT_RULES].join(" ")
}

export function createGatewayStructuredObjectOutput<OBJECT>(options: {
  description: string
  name: string
  schema: FlexibleSchema<OBJECT>
}) {
  return Output.object({
    description: options.description,
    name: options.name,
    schema: options.schema,
  })
}
