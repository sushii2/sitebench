import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it, vi } from "vitest"

import {
  buildBrandLogoUrl,
  isOnboardingComplete,
  loadCurrentUserBrand,
  markOnboardingComplete,
  normalizeBrandDraftStep,
  normalizeWebsite,
  normalizeBrandTopics,
  normalizeCompetitors,
  replaceBrandCompetitors,
  resolveBrandWebsitePreview,
  saveBrandDraftStep,
  type Brand,
  type BrandCompetitor,
  type BrandWithCompetitors,
} from "@/lib/brands"

function makeQueryBuilder<TResult>(result?: TResult) {
  const builder: Record<string, unknown> = {}

  builder.select = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.update = vi.fn(() => builder)
  builder.delete = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.then = vi.fn((resolve) => Promise.resolve(resolve(result)))

  return builder as {
    select: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    delete: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    then: ReturnType<typeof vi.fn>
  }
}

function makeClient(options: {
  brandResult?: { data: Brand | Brand[] | null; error: null }
  competitorResult?: { data: BrandCompetitor[] | null; error: null }
  currentUserId?: string | null
}) {
  const brandBuilder = makeQueryBuilder(options.brandResult)
  const competitorBuilder = makeQueryBuilder(options.competitorResult)
  const from = vi.fn((table: string) => {
    if (table === "brands") {
      return brandBuilder
    }

    if (table === "brand_competitors") {
      return competitorBuilder
    }

    throw new Error(`Unexpected table: ${table}`)
  })

  return {
    auth: {
      getCurrentUser: vi.fn(async () => ({
        data: options.currentUserId
          ? {
              user: {
                id: options.currentUserId,
                email: "jane@example.com",
                emailVerified: true,
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:00.000Z",
                metadata: null,
                profile: null,
              },
            }
          : {
              user: null,
            },
        error: null,
      })),
    },
    database: {
      from,
    },
    brandBuilder,
    competitorBuilder,
  }
}

describe("brand helpers", () => {
  it("normalizes topics by trimming, lowercasing, and deduplicating", () => {
    expect(
      normalizeBrandTopics(["  AI Search  ", "ai search", "Perplexity", " "])
    ).toEqual(["ai search", "perplexity"])
  })

  it("normalizes a step payload for storage", () => {
    expect(
      normalizeBrandDraftStep({
        company_name: "  Acme   Inc ",
        website: "Example.com/",
      })
    ).toEqual({
      company_name: "Acme Inc",
      website: "https://example.com",
    })
  })

  it("canonicalizes websites to the site root", () => {
    expect(normalizeWebsite("https://example.com/pricing?plan=pro#compare")).toBe(
      "https://example.com"
    )
  })

  it("rejects non-public websites during normalization", () => {
    expect(() =>
      normalizeBrandDraftStep({
        company_name: "Acme",
        website: "foo",
      })
    ).toThrow("Enter a valid website")
  })

  it("rejects company names that look like websites", () => {
    expect(() =>
      normalizeBrandDraftStep({
        company_name: "acme.com",
        website: "example.com",
      })
    ).toThrow("Enter a valid company name")
  })

  it("normalizes competitors for storage", () => {
    expect(
      normalizeCompetitors([
        { name: "  OpenAI  ", website: "openai.com/" },
        { name: "Anthropic", website: "https://anthropic.com" },
      ])
    ).toEqual([
      { name: "OpenAI", website: "https://openai.com" },
      { name: "Anthropic", website: "https://anthropic.com" },
    ])
  })

  it("builds a logo.dev image url for a domain", () => {
    expect(buildBrandLogoUrl("acme.com", "pk_test_123")).toBe(
      "https://img.logo.dev/acme.com?token=pk_test_123&size=64&format=png&fallback=monogram"
    )
  })

  it("resolves a website preview from raw input", () => {
    expect(resolveBrandWebsitePreview("Example.com/pricing", "pk_test_123")).toEqual(
      {
        domain: "example.com",
        logoUrl:
          "https://img.logo.dev/example.com?token=pk_test_123&size=64&format=png&fallback=monogram",
        origin: "https://example.com",
      }
    )
  })

  it("returns null when a website preview cannot be derived", () => {
    expect(resolveBrandWebsitePreview("foo", "pk_test_123")).toBeNull()
  })

  it("derives onboarding completion from the brand and competitors", () => {
    const brand: BrandWithCompetitors = {
      company_name: "Acme",
      competitors: [
        {
          brand_id: "brand-1",
          created_at: "2026-01-01T00:00:00.000Z",
          id: "competitor-1",
          name: "Competitor 1",
          updated_at: "2026-01-01T00:00:00.000Z",
          user_id: "user-1",
          website: "https://c1.com",
        },
        {
          brand_id: "brand-1",
          created_at: "2026-01-01T00:00:00.000Z",
          id: "competitor-2",
          name: "Competitor 2",
          updated_at: "2026-01-01T00:00:00.000Z",
          user_id: "user-1",
          website: "https://c2.com",
        },
        {
          brand_id: "brand-1",
          created_at: "2026-01-01T00:00:00.000Z",
          id: "competitor-3",
          name: "Competitor 3",
          updated_at: "2026-01-01T00:00:00.000Z",
          user_id: "user-1",
          website: "https://c3.com",
        },
      ],
      created_at: "2026-01-01T00:00:00.000Z",
      description: "Useful description",
      id: "brand-1",
      onboarding_completed_at: "2026-01-01T00:00:00.000Z",
      topics: ["ai search", "google ai mode", "perplexity"],
      updated_at: "2026-01-01T00:00:00.000Z",
      user_id: "user-1",
      website: "https://acme.com",
    }

    expect(isOnboardingComplete(brand)).toBe(true)
    expect(
      isOnboardingComplete({
        ...brand,
        onboarding_completed_at: null,
      })
    ).toBe(false)
  })

  it("loads the current user's brand and competitors", async () => {
    const client = makeClient({
      brandResult: {
        data: [
          {
            company_name: "Acme",
            created_at: "2026-01-01T00:00:00.000Z",
            description: "Description",
            id: "brand-1",
            onboarding_completed_at: null,
            topics: ["ai search", "perplexity"],
            updated_at: "2026-01-01T00:00:00.000Z",
            user_id: "user-1",
            website: "https://acme.com",
          },
        ],
        error: null,
      },
      competitorResult: {
        data: [
          {
            brand_id: "brand-1",
            created_at: "2026-01-01T00:00:00.000Z",
            id: "competitor-1",
            name: "Competitor 1",
            updated_at: "2026-01-01T00:00:00.000Z",
            user_id: "user-1",
            website: "https://c1.com",
          },
        ],
        error: null,
      },
      currentUserId: "user-1",
    })

    await expect(loadCurrentUserBrand(client as never)).resolves.toEqual({
      company_name: "Acme",
      competitors: [
        {
          brand_id: "brand-1",
          created_at: "2026-01-01T00:00:00.000Z",
          id: "competitor-1",
          name: "Competitor 1",
          updated_at: "2026-01-01T00:00:00.000Z",
          user_id: "user-1",
          website: "https://c1.com",
        },
      ],
      created_at: "2026-01-01T00:00:00.000Z",
      description: "Description",
      id: "brand-1",
      onboarding_completed_at: null,
      topics: ["ai search", "perplexity"],
      updated_at: "2026-01-01T00:00:00.000Z",
      user_id: "user-1",
      website: "https://acme.com",
    })
    expect(client.brandBuilder.maybeSingle).toHaveBeenCalledTimes(1)
  })

  it("creates a brand draft with array insert format", async () => {
    const client = makeClient({
      currentUserId: "user-1",
    })

    client.brandBuilder.then = vi
      .fn()
      .mockImplementationOnce((resolve) => Promise.resolve(resolve({ data: [], error: null })))
      .mockImplementationOnce((resolve) =>
        Promise.resolve(
          resolve({
            data: [
              {
                company_name: "Acme",
                created_at: "2026-01-01T00:00:00.000Z",
                description: "",
                id: "brand-1",
                onboarding_completed_at: null,
                topics: [],
                updated_at: "2026-01-01T00:00:00.000Z",
                user_id: "user-1",
                website: "https://acme.com",
              },
            ],
            error: null,
          })
        )
      )

    await saveBrandDraftStep(client as never, {
      company_name: "Acme",
      website: "acme.com",
    })

    expect(client.brandBuilder.insert).toHaveBeenCalledWith([
      {
        company_name: "Acme",
        description: "",
        onboarding_completed_at: null,
        topics: [],
        user_id: "user-1",
        website: "https://acme.com",
      },
    ])
    expect(client.brandBuilder.maybeSingle).toHaveBeenCalledTimes(2)
  })

  it("updates an existing brand draft", async () => {
    const client = makeClient({
      brandResult: {
        data: {
          company_name: "Acme",
          created_at: "2026-01-01T00:00:00.000Z",
          description: "",
          id: "brand-1",
          onboarding_completed_at: null,
          topics: [],
          updated_at: "2026-01-01T00:00:00.000Z",
          user_id: "user-1",
          website: "https://acme.com",
        },
        error: null,
      },
      currentUserId: "user-1",
    })

    client.brandBuilder.then = vi
      .fn()
      .mockImplementationOnce((resolve) =>
        Promise.resolve(
          resolve({
            data: [
              {
                company_name: "Acme",
                created_at: "2026-01-01T00:00:00.000Z",
                description: "",
                id: "brand-1",
                onboarding_completed_at: null,
                topics: [],
                updated_at: "2026-01-01T00:00:00.000Z",
                user_id: "user-1",
                website: "https://acme.com",
              },
            ],
            error: null,
          })
        )
      )
      .mockImplementationOnce((resolve) =>
        Promise.resolve(
          resolve({
            data: [
              {
                company_name: "Acme",
                created_at: "2026-01-01T00:00:00.000Z",
                description: "Updated description",
                id: "brand-1",
                onboarding_completed_at: null,
                topics: [],
                updated_at: "2026-01-01T00:00:00.000Z",
                user_id: "user-1",
                website: "https://acme.com",
              },
            ],
            error: null,
          })
        )
      )
    client.brandBuilder.update = vi.fn(() => client.brandBuilder)

    await saveBrandDraftStep(client as never, {
      description: "Updated description",
    })

    expect(client.brandBuilder.update).toHaveBeenCalledWith({
      description: "Updated description",
    })
    expect(client.brandBuilder.maybeSingle).toHaveBeenCalledTimes(2)
  })

  it("replaces competitors for a brand using delete then insert", async () => {
    const client = makeClient({
      currentUserId: "user-1",
    })

    client.competitorBuilder.delete = vi.fn(() => client.competitorBuilder)
    client.competitorBuilder.eq = vi.fn(() => client.competitorBuilder)
    client.competitorBuilder.insert = vi.fn(() => client.competitorBuilder)
    client.competitorBuilder.then = vi.fn((resolve) =>
      Promise.resolve(
        resolve({
          data: [
            {
              brand_id: "brand-1",
              created_at: "2026-01-01T00:00:00.000Z",
              id: "competitor-1",
              name: "Competitor 1",
              updated_at: "2026-01-01T00:00:00.000Z",
              user_id: "user-1",
              website: "https://c1.com",
            },
          ],
          error: null,
        })
      )
    )

    await replaceBrandCompetitors(client as never, "brand-1", [
      { name: " Competitor 1 ", website: "c1.com" },
    ])

    expect(client.competitorBuilder.delete).toHaveBeenCalledTimes(1)
    expect(client.competitorBuilder.insert).toHaveBeenCalledWith([
      {
        brand_id: "brand-1",
        name: "Competitor 1",
        user_id: "user-1",
        website: "https://c1.com",
      },
    ])
  })

  it("marks onboarding complete", async () => {
    const client = makeClient({
      currentUserId: "user-1",
    })

    client.brandBuilder.update = vi.fn(() => client.brandBuilder)
    client.brandBuilder.eq = vi.fn(() => client.brandBuilder)
    client.brandBuilder.then = vi.fn((resolve) =>
      Promise.resolve(
        resolve({
          data: [
            {
              company_name: "Acme",
              created_at: "2026-01-01T00:00:00.000Z",
              description: "Description",
              id: "brand-1",
              onboarding_completed_at: "2026-04-01T00:00:00.000Z",
              topics: ["ai search", "perplexity", "google ai mode"],
              updated_at: "2026-01-01T00:00:00.000Z",
              user_id: "user-1",
              website: "https://acme.com",
            },
          ],
          error: null,
        })
      )
    )

    const result = await markOnboardingComplete(client as never, "brand-1")

    expect(client.brandBuilder.update).toHaveBeenCalledWith({
      onboarding_completed_at: expect.any(String),
    })
    expect(result.onboarding_completed_at).toEqual(expect.any(String))
    expect(client.brandBuilder.maybeSingle).toHaveBeenCalledTimes(1)
  })

  it("keeps the SQL schema artifact aligned with the brand model", () => {
    const schemaPath = resolve(process.cwd(), "lib/brands/schema.sql")
    const schema = readFileSync(schemaPath, "utf8")

    expect(schema).toContain("CREATE TABLE brands")
    expect(schema).toContain("CREATE TABLE brand_competitors")
    expect(schema).toContain("topics TEXT[] NOT NULL DEFAULT '{}'::text[]")
    expect(schema).toContain("ALTER TABLE brands ENABLE ROW LEVEL SECURITY")
    expect(schema).toContain("ALTER TABLE brand_competitors ENABLE ROW LEVEL SECURITY")
    expect(schema).toContain("system.update_updated_at()")
    expect(schema).toContain("auth.uid()")
  })
})
