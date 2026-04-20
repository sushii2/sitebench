import type { InsForgeClient } from "@insforge/sdk"

export type PromptPipelineClient = Pick<InsForgeClient, "auth" | "database">
