import { beforeEach, describe, expect, it, vi } from "vitest"

const mockStartDuePromptPipelineRuns = vi.fn()

vi.mock("@/lib/prompt-pipeline", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/prompt-pipeline")>(
      "@/lib/prompt-pipeline"
    )

  return {
    ...actual,
    startDuePromptPipelineRuns: mockStartDuePromptPipelineRuns,
  }
})

async function loadRoute() {
  return import("@/app/api/prompt-pipeline/cron/route")
}

describe("GET /api/prompt-pipeline/cron", () => {
  beforeEach(() => {
    vi.resetModules()
    mockStartDuePromptPipelineRuns.mockReset()
    mockStartDuePromptPipelineRuns.mockResolvedValue({
      enqueuedCount: 2,
      workflowRunIds: ["workflow-run-1", "workflow-run-2"],
    })
    process.env.CRON_SECRET = "cron-secret"
  })

  it("rejects requests without the cron secret", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      new Request("http://localhost/api/prompt-pipeline/cron")
    )

    expect(response.status).toBe(401)
  })

  it("starts due prompt pipeline runs with a valid cron secret", async () => {
    const { GET } = await loadRoute()
    const response = await GET(
      new Request("http://localhost/api/prompt-pipeline/cron", {
        headers: {
          Authorization: "Bearer cron-secret",
        },
      })
    )

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      enqueuedCount: 2,
      workflowRunIds: ["workflow-run-1", "workflow-run-2"],
    })
  })
})
