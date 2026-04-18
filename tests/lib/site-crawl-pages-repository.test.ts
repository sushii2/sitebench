import { describe, expect, it, vi } from "vitest"

import { replaceSiteCrawlPages } from "@/lib/site-crawl-pages/repository"

function makeQueryBuilder<TResult>(result?: TResult) {
  const builder: Record<string, unknown> = {}

  builder.delete = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.select = vi.fn(() => builder)
  builder.then = vi.fn((resolve, reject) =>
    Promise.resolve(result).then(resolve, reject)
  )

  return builder as {
    delete: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    select: ReturnType<typeof vi.fn>
    then: ReturnType<typeof vi.fn>
  }
}

describe("site crawl pages repository", () => {
  it("throws when clearing existing crawl pages fails", async () => {
    const deleteBuilder = makeQueryBuilder({
      data: null,
      error: new Error("delete failed"),
    })
    const client = {
      database: {
        from: vi.fn(() => deleteBuilder),
      },
    }

    await expect(
      replaceSiteCrawlPages(client as never, "run-1", "project-1", [])
    ).rejects.toThrow("delete failed")
    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(deleteBuilder.eq).toHaveBeenCalledWith("crawl_run_id", "run-1")
  })
})
