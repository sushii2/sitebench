import type {
  PromptPipelineRun,
  PromptPipelineWorkflowPrompt,
} from "@/lib/prompt-pipeline/types"

export interface PromptPipelineWorkflowInput {
  configId: string
  pipelineRunId: string
  projectId: string
  requestId: string
  scheduledFor: string
  triggerType: "manual" | "scheduled"
}

export interface PromptPipelineWorkflowState extends PromptPipelineWorkflowInput {
  pipelineRun: PromptPipelineRun
  selectedPrompts: PromptPipelineWorkflowPrompt[]
}

export interface PromptPipelinePlatformExecutionState
  extends PromptPipelineWorkflowState {
  prompt: PromptPipelineWorkflowPrompt
  platformCode: "chatgpt" | "claude" | "perplexity"
}

export interface PromptPipelinePlatformResult
  extends PromptPipelinePlatformExecutionState {
  inputTokens: number | null
  latencyMs: number | null
  modelId: string | null
  outputTokens: number | null
  parsedBrands: unknown
  parsedCitations: unknown
  parserWarnings: string[]
  rawResponseJson: Record<string, unknown> | null
  rawResponseText: string | null
}
