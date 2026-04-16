export type PromptRunResponseStatus =
  | "completed"
  | "failed"
  | "timeout"
  | "blocked"
  | "rate_limited"

export interface PromptRunResponse {
  id: string
  project_id: string
  prompt_run_id: string
  platform_code: string
  provider_model: string | null
  prompt_text: string
  raw_response_text: string | null
  raw_response_json: Record<string, unknown> | null
  parser_version: string
  status: PromptRunResponseStatus
  latency_ms: number | null
  input_tokens: number | null
  output_tokens: number | null
  error_code: string | null
  error_message: string | null
  responded_at: string | null
  created_at: string
}
