import "server-only"

import { put } from "@vercel/blob"

export interface UploadRawResponseJsonInput {
  platformCode: string
  projectId: string
  rawResponseJson: Record<string, unknown>
  scheduledFor: string
  trackedPromptId: string
}

export async function uploadRawResponseJson(
  input: UploadRawResponseJsonInput
): Promise<string> {
  const safeScheduledFor = input.scheduledFor.replace(/[:.]/g, "-")
  const pathname = `prompt-runs/${input.projectId}/${safeScheduledFor}/${input.trackedPromptId}-${input.platformCode}.json`

  const result = await put(pathname, JSON.stringify(input.rawResponseJson), {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  })

  return result.url
}
