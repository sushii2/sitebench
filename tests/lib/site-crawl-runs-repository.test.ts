import { afterEach, describe, expect, it, vi } from "vitest"

import { createSiteCrawlRun } from "@/lib/site-crawl-runs/repository"

function makeQueryBuilder<TResult>(result?: TResult) {
  const builder: Record<string, unknown> = {}

  builder.eq = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.select = vi.fn(() => builder)
  builder.then = vi.fn((resolve) => Promise.resolve(resolve(result)))
  builder.maybeSingle = vi.fn(() => Promise.resolve(result))

  return builder as {
    eq: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    then: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    select: ReturnType<typeof vi.fn>
  }
}

describe("site crawl run repository", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("reloads a crawl run by id when insert returns no row", async () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi.fn(() => "run-1"),
    })

    const insertBuilder = makeQueryBuilder({
      data: [],
      error: null,
    })
    const selectBuilder = makeQueryBuilder({
      data: {
        analysis_version: 2,
        completed_at: null,
        created_at: "2026-01-01T00:00:00.000Z",
        error_message: null,
        firecrawl_job_ids: [],
        id: "run-1",
        project_id: "project-1",
        result_json: null,
        selected_url_count: 0,
        started_at: "2026-01-01T00:00:00.000Z",
        status: "mapping",
        trigger_type: "onboarding",
        updated_at: "2026-01-01T00:00:00.000Z",
        workflow_run_id: null,
        warnings: [],
      },
      error: null,
    })
    const from = vi.fn((table: string) => {
      if (table !== "site_crawl_runs") {
        throw new Error(`Unexpected table: ${table}`)
      }

      if (from.mock.calls.length === 1) {
        return insertBuilder
      }

      if (from.mock.calls.length === 2) {
        return selectBuilder
      }

      throw new Error(`Unexpected call count: ${from.mock.calls.length}`)
    })
    const client = {
      database: {
        from,
      },
    }

    const run = await createSiteCrawlRun(client as never, {
      projectId: "project-1",
    })

    expect(insertBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        id: "run-1",
        project_id: "project-1",
      }),
    ])
    expect(selectBuilder.eq).toHaveBeenCalledWith("id", "run-1")
    expect(run.id).toBe("run-1")
  })
})
