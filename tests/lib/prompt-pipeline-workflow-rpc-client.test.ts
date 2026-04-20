import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

describe("createPromptPipelineWorkflowRpcClient", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.resetModules()
    vi.stubGlobal("fetch", fetchMock)
    process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY = "anon-key"
    process.env.NEXT_PUBLIC_INSFORGE_URL = "https://example.insforge.app"
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY
    delete process.env.NEXT_PUBLIC_INSFORGE_URL
  })

  it("calls InsForge RPC endpoints over fetch with the public config", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({
        pipeline_run: {
          id: "pipeline-run-1",
        },
      }),
      ok: true,
    })

    const { createPromptPipelineWorkflowRpcClient } = await import(
      "@/lib/prompt-pipeline/workflow-rpc-client"
    )
    const client = createPromptPipelineWorkflowRpcClient()

    await expect(
      client.database.rpc("begin_prompt_pipeline_run", {
        pipeline_run_id: "pipeline-run-1",
      })
    ).resolves.toEqual({
      data: {
        pipeline_run: {
          id: "pipeline-run-1",
        },
      },
      error: null,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.insforge.app/api/database/rpc/begin_prompt_pipeline_run",
      {
        body: JSON.stringify({
          pipeline_run_id: "pipeline-run-1",
        }),
        headers: {
          Authorization: "Bearer anon-key",
          "Content-Type": "application/json",
        },
        method: "POST",
      }
    )
  })

  it("returns an error object when the RPC response is not ok", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({
        message: "No such function",
      }),
      ok: false,
      status: 404,
      text: async () => JSON.stringify({
        message: "No such function",
      }),
    })

    const { createPromptPipelineWorkflowRpcClient } = await import(
      "@/lib/prompt-pipeline/workflow-rpc-client"
    )
    const client = createPromptPipelineWorkflowRpcClient()
    const response = await client.database.rpc("missing_function", {})

    expect(response.data).toBeNull()
    expect(response.error).toBeInstanceOf(Error)
    expect(response.error?.message).toContain("No such function")
  })

  it("removes broken unicode sequences from nested RPC payload strings", async () => {
    fetchMock.mockResolvedValue({
      json: async () => ({
        ok: true,
      }),
      ok: true,
      text: async () => JSON.stringify({
        ok: true,
      }),
    })

    const { createPromptPipelineWorkflowRpcClient } = await import(
      "@/lib/prompt-pipeline/workflow-rpc-client"
    )
    const client = createPromptPipelineWorkflowRpcClient()

    await client.database.rpc("record_prompt_platform_result", {
      nested: {
        broken: "a\u0000b",
        stillValid: "keep cafe and emoji \u{1F600}",
      },
      raw_response_text: "prefix\uD800suffix",
      values: ["ok", "x\u0000y", "before\uDC00after"],
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.insforge.app/api/database/rpc/record_prompt_platform_result",
      expect.objectContaining({
        body: JSON.stringify({
          nested: {
            broken: "ab",
            stillValid: "keep cafe and emoji \u{1F600}",
          },
          raw_response_text: "prefixsuffix",
          values: ["ok", "xy", "beforeafter"],
        }),
      })
    )
  })
})
