import { describe, expect, it } from "vitest"

import { loadCitationsForResponses } from "@/lib/chats/repository"

type QueryResult = { data: unknown; error: unknown }

function makeBuilder(queue: QueryResult[]) {
  const calls: Array<{
    table: string
    select?: string
    filters: Array<[string, unknown]>
    inFilters: Array<[string, unknown]>
    orderBy?: string
  }> = []

  const database = {
    from(table: string) {
      const call: (typeof calls)[number] = {
        filters: [],
        inFilters: [],
        table,
      }
      let result = queue.shift() ?? { data: [], error: null }

      const builder = {
        select(expr?: string) {
          call.select = expr
          return builder
        },
        eq(column: string, value: unknown) {
          call.filters.push([column, value])
          return builder
        },
        in(column: string, values: unknown[]) {
          call.inFilters.push([column, values])
          return builder
        },
        order(column: string) {
          call.orderBy = column
          return builder
        },
        then<T>(
          resolve: (value: QueryResult) => T,
          reject?: (reason: unknown) => T
        ) {
          return Promise.resolve(result).then(resolve, reject)
        },
      }

      calls.push(call)
      void result
      return builder
    },
  }

  return { calls, database }
}

describe("loadCitationsForResponses", () => {
  it("returns an empty map when no response ids are provided", async () => {
    const { database, calls } = makeBuilder([])
    const result = await loadCitationsForResponses(
      { database: database as never },
      []
    )

    expect(result.size).toBe(0)
    expect(calls).toHaveLength(0)
  })

  it("loads citations, pages, and domains, then groups by response id", async () => {
    const citations = [
      {
        authority_score: null,
        citation_order: 1,
        citation_text: null,
        cited_url: "https://vercel.com/docs",
        created_at: "2026-04-20T12:00:00.000Z",
        id: "cit-1",
        project_id: "project-1",
        response_id: "resp-1",
        source_page_id: "page-1",
      },
      {
        authority_score: null,
        citation_order: 2,
        citation_text: null,
        cited_url: "https://netlify.com/docs",
        created_at: "2026-04-20T12:00:00.000Z",
        id: "cit-2",
        project_id: "project-1",
        response_id: "resp-1",
        source_page_id: "page-2",
      },
      {
        authority_score: null,
        citation_order: 1,
        citation_text: null,
        cited_url: "https://aws.amazon.com",
        created_at: "2026-04-20T12:00:00.000Z",
        id: "cit-3",
        project_id: "project-1",
        response_id: "resp-2",
        source_page_id: "page-3",
      },
    ]

    const pages = [
      {
        canonical_url: "https://vercel.com/docs",
        domain_id: "domain-1",
        first_seen_at: "2026-04-20T12:00:00.000Z",
        id: "page-1",
        page_title: "Vercel Docs",
      },
      {
        canonical_url: "https://netlify.com/docs",
        domain_id: "domain-2",
        first_seen_at: "2026-04-20T12:00:00.000Z",
        id: "page-2",
        page_title: "Netlify Docs",
      },
      {
        canonical_url: "https://aws.amazon.com",
        domain_id: "domain-3",
        first_seen_at: "2026-04-20T12:00:00.000Z",
        id: "page-3",
        page_title: "AWS",
      },
    ]

    const domains = [
      {
        created_at: "2026-04-01T00:00:00.000Z",
        display_name: null,
        domain: "vercel.com",
        id: "domain-1",
        root_domain: "vercel.com",
      },
      {
        created_at: "2026-04-01T00:00:00.000Z",
        display_name: null,
        domain: "netlify.com",
        id: "domain-2",
        root_domain: "netlify.com",
      },
      {
        created_at: "2026-04-01T00:00:00.000Z",
        display_name: null,
        domain: "aws.amazon.com",
        id: "domain-3",
        root_domain: "amazon.com",
      },
    ]
    const attributions = [
      {
        response_brand_metrics: { brand_entity_id: "brand-1" },
        response_citation_id: "cit-1",
      },
      {
        response_brand_metrics: { brand_entity_id: "brand-2" },
        response_citation_id: "cit-2",
      },
    ]

    const { calls, database } = makeBuilder([
      { data: citations, error: null },
      { data: attributions, error: null },
      { data: pages, error: null },
      { data: domains, error: null },
    ])

    const result = await loadCitationsForResponses(
      { database: database as never },
      ["resp-1", "resp-2"]
    )

    expect(calls.map((call) => call.table)).toEqual([
      "response_citations",
      "response_brand_citations",
      "source_pages",
      "source_domains",
    ])
    expect(calls[0].inFilters).toEqual([["response_id", ["resp-1", "resp-2"]]])
    expect(calls[1].inFilters).toEqual([
      ["response_citation_id", ["cit-1", "cit-2", "cit-3"]],
    ])
    expect(calls[2].inFilters).toEqual([
      ["id", ["page-1", "page-2", "page-3"]],
    ])
    expect(calls[3].inFilters).toEqual([
      ["id", ["domain-1", "domain-2", "domain-3"]],
    ])

    expect(result.get("resp-1")).toHaveLength(2)
    expect(result.get("resp-2")).toHaveLength(1)
    expect(result.get("resp-1")?.[0].domain.domain).toBe("vercel.com")
    expect(result.get("resp-1")?.[0].attributedBrandIds).toEqual(["brand-1"])
  })

  it("skips citations whose source_page_id cannot be resolved", async () => {
    const { database } = makeBuilder([
      {
        data: [
          {
            authority_score: null,
            citation_order: 1,
            citation_text: null,
            cited_url: "https://orphan.example/post",
            created_at: "2026-04-20T12:00:00.000Z",
            id: "cit-1",
            project_id: "project-1",
            response_id: "resp-1",
            source_page_id: "missing-page",
          },
        ],
        error: null,
      },
      { data: [], error: null },
      { data: [], error: null },
      { data: [], error: null },
    ])

    const result = await loadCitationsForResponses(
      { database: database as never },
      ["resp-1"]
    )

    expect(result.size).toBe(0)
  })

  it("propagates query errors", async () => {
    const { database } = makeBuilder([
      { data: null, error: new Error("boom") },
    ])

    await expect(
      loadCitationsForResponses({ database: database as never }, ["resp-1"])
    ).rejects.toThrow("boom")
  })
})
