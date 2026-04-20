import { beforeEach, describe, expect, it, vi } from "vitest"

const getRunMock = vi.fn()

vi.mock("workflow/api", () => ({
  getRun: getRunMock,
}))

describe("prompt pipeline repository", () => {
  beforeEach(() => {
    vi.resetModules()
    getRunMock.mockReset()
  })

  it("returns an empty trace list and stops retrying when the trace table is unavailable", async () => {
    const { loadPromptPipelineRunTraceRows } = await import(
      "@/lib/prompt-pipeline/repository"
    )
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    let fromCallCount = 0

    const client = {
      database: {
        from() {
          fromCallCount += 1

          return {
            select() {
              return {
                eq() {
                  return {
                    order: async () => ({
                      data: null,
                      error: {
                        message:
                          'relation "prompt_pipeline_run_traces" does not exist',
                      },
                    }),
                  }
                },
              }
            },
          }
        },
      },
    }

    await expect(
      loadPromptPipelineRunTraceRows(client as never, "pipeline-run-1")
    ).resolves.toEqual([])
    await expect(
      loadPromptPipelineRunTraceRows(client as never, "pipeline-run-1")
    ).resolves.toEqual([])

    expect(fromCallCount).toBe(1)
    expect(warnSpy).toHaveBeenCalledTimes(1)

    warnSpy.mockRestore()
  })

  it("cancels stale active runs whose workflow run no longer exists", async () => {
    getRunMock.mockReturnValue({
      exists: Promise.resolve(false),
    })

    const rpcMock = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })

    const client = {
      database: {
        from() {
          return {
            select() {
              return {
                eq(column: string) {
                  if (column === "config_id") {
                    return {
                      in() {
                        return {
                          order() {
                            return {
                              limit() {
                                return {
                                  maybeSingle: async () => ({
                                    data: {
                                      id: "pipeline-run-1",
                                      project_id: "project-1",
                                      config_id: "config-1",
                                      trigger_type: "manual",
                                      status: "running",
                                      scheduled_for: "2026-04-20T21:00:00.000Z",
                                      workflow_run_id: "workflow-run-1",
                                      request_id: "request-1",
                                      selection_snapshot_json: {},
                                      prompt_count_total: 40,
                                      prompt_count_completed: 0,
                                      prompt_count_partial: 0,
                                      prompt_count_failed: 0,
                                      failure_reason: null,
                                      created_at: "2026-04-20T21:00:00.000Z",
                                      updated_at: "2026-04-20T21:00:00.000Z",
                                    },
                                    error: null,
                                  }),
                                }
                              },
                            }
                          },
                        }
                      },
                    }
                  }

                  return {
                    maybeSingle: async () => ({
                      data: {
                        id: "pipeline-run-1",
                        project_id: "project-1",
                        config_id: "config-1",
                        trigger_type: "manual",
                        status: "cancelled",
                        scheduled_for: "2026-04-20T21:00:00.000Z",
                        workflow_run_id: "workflow-run-1",
                        request_id: "request-1",
                        selection_snapshot_json: {},
                        prompt_count_total: 40,
                        prompt_count_completed: 0,
                        prompt_count_partial: 0,
                        prompt_count_failed: 0,
                        failure_reason: "Workflow was stopped before completion.",
                        created_at: "2026-04-20T21:00:00.000Z",
                        updated_at: "2026-04-20T21:01:00.000Z",
                      },
                      error: null,
                    }),
                  }
                },
              }
            },
          }
        },
        rpc: rpcMock,
      },
    }

    const { resolveBlockingPromptPipelineRun } = await import(
      "@/lib/prompt-pipeline/repository"
    )

    await expect(
      resolveBlockingPromptPipelineRun(client as never, "config-1")
    ).resolves.toMatchObject({
      id: "pipeline-run-1",
      status: "cancelled",
    })

    expect(rpcMock).toHaveBeenCalledWith("cancel_prompt_pipeline_run", {
      failure_reason: "Workflow was stopped before completion.",
      pipeline_run_id: "pipeline-run-1",
    })
  })
})
