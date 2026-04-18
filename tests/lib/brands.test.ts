import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it, vi } from "vitest"

import {
  buildBrandLogoUrl,
  isOnboardingComplete,
  isProjectOnboardingComplete,
  loadCurrentUserBrand,
  loadCurrentUserProjectProfile,
  markOnboardingComplete,
  normalizeBrandDraftStep,
  normalizeBrandTopics,
  normalizeCompetitors,
  normalizeWebsite,
  replaceBrandCompetitors,
  resolveBrandWebsitePreview,
  saveBrandDraftStep,
  type Brand,
  type BrandEntity,
  type ProjectProfile,
  type ProjectTopic,
  type TrackingProject,
} from "@/lib/brands"

function makeQueryBuilder<TResult>(result?: TResult) {
  const builder: Record<string, unknown> = {}

  builder.delete = vi.fn(() => builder)
  builder.eq = vi.fn(() => builder)
  builder.in = vi.fn(() => builder)
  builder.insert = vi.fn(() => builder)
  builder.is = vi.fn(() => builder)
  builder.maybeSingle = vi.fn(() => builder)
  builder.not = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.select = vi.fn(() => builder)
  builder.then = vi.fn((resolve) => Promise.resolve(resolve(result)))
  builder.update = vi.fn(() => builder)

  return builder as {
    delete: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    in: ReturnType<typeof vi.fn>
    insert: ReturnType<typeof vi.fn>
    is: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
    not: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    select: ReturnType<typeof vi.fn>
    then: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
  }
}

function makeProject(overrides: Partial<TrackingProject> = {}): TrackingProject {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    id: "project-1",
    market_category: null,
    onboarding_completed_at: null,
    onboarding_status: "draft",
    reporting_timezone: "UTC",
    updated_at: "2026-01-01T00:00:00.000Z",
    user_id: "user-1",
    ...overrides,
  }
}

function makeBrandEntity(overrides: Partial<BrandEntity> = {}): BrandEntity {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    description: "",
    id: "entity-1",
    is_active: true,
    name: "Acme",
    normalized_name: "acme",
    project_id: "project-1",
    role: "primary",
    sort_order: 0,
    updated_at: "2026-01-01T00:00:00.000Z",
    website_host: "acme.com",
    website_url: "https://acme.com",
    ...overrides,
  }
}

function makeTopic(overrides: Partial<ProjectTopic> = {}): ProjectTopic {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    default_cadence: "weekly",
    id: "topic-1",
    is_active: true,
    name: "ai search",
    normalized_name: "ai search",
    project_id: "project-1",
    sort_order: 0,
    source: "user_added",
    topic_catalog_id: null,
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  }
}

function makeClient(options: {
  brandEntityResult?: { data: BrandEntity[] | BrandEntity | null; error: null }
  currentUserId?: string | null
  projectResult?: { data: TrackingProject[] | TrackingProject | null; error: null }
  topicResult?: { data: ProjectTopic[] | ProjectTopic | null; error: null }
}) {
  const projectBuilder = makeQueryBuilder(options.projectResult)
  const brandEntityBuilder = makeQueryBuilder(options.brandEntityResult)
  const topicBuilder = makeQueryBuilder(options.topicResult)
  const from = vi.fn((table: string) => {
    if (table === "tracking_projects") {
      return projectBuilder
    }

    if (table === "brand_entities") {
      return brandEntityBuilder
    }

    if (table === "project_topics") {
      return topicBuilder
    }

    throw new Error(`Unexpected table: ${table}`)
  })

  return {
    auth: {
      getCurrentUser: vi.fn(async () => ({
        data: options.currentUserId
          ? {
              user: {
                createdAt: "2026-01-01T00:00:00.000Z",
                email: "jane@example.com",
                emailVerified: true,
                id: options.currentUserId,
                metadata: null,
                profile: null,
                updatedAt: "2026-01-01T00:00:00.000Z",
              },
            }
          : {
              user: null,
            },
        error: null,
      })),
    },
    brandEntityBuilder,
    database: {
      from,
    },
    projectBuilder,
    topicBuilder,
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

  it("derives onboarding completion from a project profile", () => {
    const profile: ProjectProfile = {
      competitors: [
        makeBrandEntity({
          id: "entity-2",
          name: "Competitor 1",
          normalized_name: "competitor 1",
          role: "competitor",
          sort_order: 1,
          website_host: "c1.com",
          website_url: "https://c1.com",
        }),
        makeBrandEntity({
          id: "entity-3",
          name: "Competitor 2",
          normalized_name: "competitor 2",
          role: "competitor",
          sort_order: 2,
          website_host: "c2.com",
          website_url: "https://c2.com",
        }),
        makeBrandEntity({
          id: "entity-4",
          name: "Competitor 3",
          normalized_name: "competitor 3",
          role: "competitor",
          sort_order: 3,
          website_host: "c3.com",
          website_url: "https://c3.com",
        }),
      ],
      primaryBrand: makeBrandEntity({
        description: "Useful description",
      }),
      project: makeProject({
        onboarding_completed_at: "2026-01-02T00:00:00.000Z",
        onboarding_status: "complete",
      }),
      topics: [
        makeTopic({
          id: "topic-1",
          name: "ai search",
          normalized_name: "ai search",
        }),
        makeTopic({
          id: "topic-2",
          name: "google ai mode",
          normalized_name: "google ai mode",
          sort_order: 1,
        }),
        makeTopic({
          id: "topic-3",
          name: "perplexity",
          normalized_name: "perplexity",
          sort_order: 2,
        }),
      ],
    }

    expect(isProjectOnboardingComplete(profile)).toBe(true)

    const onboardingBrand: Brand = {
      company_name: "Acme",
      created_at: "2026-01-01T00:00:00.000Z",
      description: "Useful description",
      id: "project-1",
      onboarding_completed_at: "2026-01-02T00:00:00.000Z",
      topics: ["ai search", "google ai mode", "perplexity"],
      updated_at: "2026-01-01T00:00:00.000Z",
      user_id: "user-1",
      website: "https://acme.com",
    }

    expect(
      isOnboardingComplete({
        ...onboardingBrand,
        competitors: [
          {
            brand_id: "project-1",
            created_at: "2026-01-01T00:00:00.000Z",
            id: "entity-2",
            name: "Competitor 1",
            updated_at: "2026-01-01T00:00:00.000Z",
            user_id: "user-1",
            website: "https://c1.com",
          },
          {
            brand_id: "project-1",
            created_at: "2026-01-01T00:00:00.000Z",
            id: "entity-3",
            name: "Competitor 2",
            updated_at: "2026-01-01T00:00:00.000Z",
            user_id: "user-1",
            website: "https://c2.com",
          },
          {
            brand_id: "project-1",
            created_at: "2026-01-01T00:00:00.000Z",
            id: "entity-4",
            name: "Competitor 3",
            updated_at: "2026-01-01T00:00:00.000Z",
            user_id: "user-1",
            website: "https://c3.com",
          },
        ],
      })
    ).toBe(true)
  })

  it("loads the current user's project profile from the normalized tables", async () => {
    const client = makeClient({
      brandEntityResult: {
        data: [
          makeBrandEntity(),
          makeBrandEntity({
            id: "entity-2",
            name: "Competitor 1",
            normalized_name: "competitor 1",
            role: "competitor",
            sort_order: 1,
            website_host: "c1.com",
            website_url: "https://c1.com",
          }),
        ],
        error: null,
      },
      currentUserId: "user-1",
      projectResult: {
        data: [makeProject()],
        error: null,
      },
      topicResult: {
        data: [
          makeTopic({
            id: "topic-1",
            name: "ai search",
            normalized_name: "ai search",
          }),
        ],
        error: null,
      },
    })

    await expect(loadCurrentUserProjectProfile(client as never)).resolves.toEqual({
      competitors: [
        makeBrandEntity({
          id: "entity-2",
          name: "Competitor 1",
          normalized_name: "competitor 1",
          role: "competitor",
          sort_order: 1,
          website_host: "c1.com",
          website_url: "https://c1.com",
        }),
      ],
      primaryBrand: makeBrandEntity(),
      project: makeProject(),
      topics: [
        makeTopic({
          id: "topic-1",
          name: "ai search",
          normalized_name: "ai search",
        }),
      ],
    })
  })

  it("adapts the current user's project profile for the onboarding UI", async () => {
    const client = makeClient({
      brandEntityResult: {
        data: [
          makeBrandEntity({
            description: "Description",
          }),
          makeBrandEntity({
            id: "entity-2",
            name: "Competitor 1",
            normalized_name: "competitor 1",
            role: "competitor",
            sort_order: 1,
            website_host: "c1.com",
            website_url: "https://c1.com",
          }),
        ],
        error: null,
      },
      currentUserId: "user-1",
      projectResult: {
        data: [makeProject()],
        error: null,
      },
      topicResult: {
        data: [
          makeTopic({
            id: "topic-1",
            name: "ai search",
            normalized_name: "ai search",
          }),
          makeTopic({
            id: "topic-2",
            name: "perplexity",
            normalized_name: "perplexity",
            sort_order: 1,
          }),
        ],
        error: null,
      },
    })

    await expect(loadCurrentUserBrand(client as never)).resolves.toEqual({
      company_name: "Acme",
      competitors: [
        {
          brand_id: "project-1",
          created_at: "2026-01-01T00:00:00.000Z",
          id: "entity-2",
          name: "Competitor 1",
          updated_at: "2026-01-01T00:00:00.000Z",
          user_id: "user-1",
          website: "https://c1.com",
        },
      ],
      created_at: "2026-01-01T00:00:00.000Z",
      description: "Description",
      id: "project-1",
      onboarding_completed_at: null,
      topics: ["ai search", "perplexity"],
      updated_at: "2026-01-01T00:00:00.000Z",
      user_id: "user-1",
      website: "https://acme.com",
    })
  })

  it("creates a tracking project and primary brand on step 1", async () => {
    const client = makeClient({
      currentUserId: "user-1",
    })

    client.projectBuilder.then = vi
      .fn()
      .mockImplementationOnce((resolve) =>
        Promise.resolve(resolve({ data: null, error: null }))
      )
      .mockImplementationOnce((resolve) =>
        Promise.resolve(resolve({ data: [makeProject()], error: null }))
      )
    client.brandEntityBuilder.then = vi.fn((resolve) =>
      Promise.resolve(
        resolve({
          data: [
            makeBrandEntity({
              name: "Acme",
              normalized_name: "acme",
              website_host: "acme.com",
              website_url: "https://acme.com",
            }),
          ],
          error: null,
        })
      )
    )

    const result = await saveBrandDraftStep(client as never, {
      company_name: "Acme",
      website: "acme.com",
    })

    expect(client.projectBuilder.insert).toHaveBeenCalledWith([
      {
        onboarding_completed_at: null,
        onboarding_status: "draft",
        reporting_timezone: "UTC",
        user_id: "user-1",
      },
    ])
    expect(client.brandEntityBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "Acme",
        normalized_name: "acme",
        project_id: "project-1",
        role: "primary",
        website_host: "acme.com",
        website_url: "https://acme.com",
      }),
    ])
    expect(result.company_name).toBe("Acme")
    expect(result.id).toBe("project-1")
  })

  it("updates an existing primary brand description on step 2", async () => {
    const client = makeClient({
      brandEntityResult: {
        data: [makeBrandEntity()],
        error: null,
      },
      currentUserId: "user-1",
      projectResult: {
        data: makeProject(),
        error: null,
      },
      topicResult: {
        data: [],
        error: null,
      },
    })

    client.brandEntityBuilder.then = vi
      .fn()
      .mockImplementationOnce((resolve) =>
        Promise.resolve(resolve({ data: [makeBrandEntity()], error: null }))
      )
      .mockImplementationOnce((resolve) =>
        Promise.resolve(
          resolve({
            data: [
              makeBrandEntity({
                description: "Updated description",
              }),
            ],
            error: null,
          })
        )
      )

    await saveBrandDraftStep(client as never, {
      description: "Updated description",
    })

    expect(client.brandEntityBuilder.update).toHaveBeenCalledWith({
      description: "Updated description",
    })
  })

  it("replaces project topics on step 3", async () => {
    const client = makeClient({
      brandEntityResult: {
        data: [makeBrandEntity()],
        error: null,
      },
      currentUserId: "user-1",
      projectResult: {
        data: makeProject(),
        error: null,
      },
      topicResult: {
        data: [],
        error: null,
      },
    })

    client.topicBuilder.then = vi
      .fn()
      .mockImplementationOnce((resolve) =>
        Promise.resolve(resolve({ data: [], error: null }))
      )
      .mockImplementationOnce((resolve) =>
        Promise.resolve(
          resolve({
            data: [
              makeTopic({
                id: "topic-1",
                name: "ai search",
                normalized_name: "ai search",
              }),
              makeTopic({
                id: "topic-2",
                name: "perplexity",
                normalized_name: "perplexity",
                sort_order: 1,
              }),
            ],
            error: null,
          })
        )
      )

    const result = await saveBrandDraftStep(client as never, {
      topics: [" AI Search ", "perplexity"],
    })

    expect(client.topicBuilder.delete).toHaveBeenCalledTimes(1)
    expect(client.topicBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        default_cadence: "weekly",
        name: "ai search",
        normalized_name: "ai search",
        project_id: "project-1",
        sort_order: 0,
      }),
      expect.objectContaining({
        default_cadence: "weekly",
        name: "perplexity",
        normalized_name: "perplexity",
        project_id: "project-1",
        sort_order: 1,
      }),
    ])
    expect(result.topics).toEqual(["ai search", "perplexity"])
  })

  it("replaces competitors using brand entities scoped to the project", async () => {
    const client = makeClient({
      currentUserId: "user-1",
    })

    client.brandEntityBuilder.then = vi.fn((resolve) =>
      Promise.resolve(
        resolve({
          data: [
            makeBrandEntity({
              id: "entity-2",
              name: "Competitor 1",
              normalized_name: "competitor 1",
              role: "competitor",
              sort_order: 0,
              website_host: "c1.com",
              website_url: "https://c1.com",
            }),
          ],
          error: null,
        })
      )
    )

    await replaceBrandCompetitors(client as never, "project-1", [
      { name: " Competitor 1 ", website: "c1.com" },
    ])

    expect(client.brandEntityBuilder.delete).toHaveBeenCalledTimes(1)
    expect(client.brandEntityBuilder.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "Competitor 1",
        normalized_name: "competitor 1",
        project_id: "project-1",
        role: "competitor",
        website_host: "c1.com",
        website_url: "https://c1.com",
      }),
    ])
  })

  it("marks onboarding complete on the tracking project", async () => {
    const client = makeClient({
      currentUserId: "user-1",
    })

    client.projectBuilder.update = vi.fn(() => client.projectBuilder)
    client.projectBuilder.eq = vi.fn(() => client.projectBuilder)
    client.projectBuilder.then = vi.fn((resolve) =>
      Promise.resolve(
        resolve({
          data: [
            makeProject({
              onboarding_completed_at: "2026-04-01T00:00:00.000Z",
              onboarding_status: "complete",
            }),
          ],
          error: null,
        })
      )
    )

    const result = await markOnboardingComplete(client as never, "project-1")

    expect(client.projectBuilder.update).toHaveBeenCalledWith({
      onboarding_completed_at: expect.any(String),
      onboarding_status: "complete",
    })
    expect(result.onboarding_completed_at).toEqual(expect.any(String))
    expect(result.id).toBe("project-1")
  })

  it("keeps the migration and schema document aligned with the normalized model", () => {
    const migrationPath = resolve(
      process.cwd(),
      "db/migrations/0001_brand_intelligence.sql"
    )
    const docsPath = resolve(
      process.cwd(),
      "docs/database/brand-intelligence-schema.md"
    )
    const migration = readFileSync(migrationPath, "utf8")
    const docs = readFileSync(docsPath, "utf8")

    expect(migration).toContain("CREATE TABLE tracking_projects")
    expect(migration).toContain("CREATE TABLE brand_entities")
    expect(migration).toContain("CREATE TABLE project_topics")
    expect(migration).toContain("CREATE TABLE prompt_run_responses")
    expect(migration).toContain("CREATE TABLE response_citations")
    expect(migration).toContain("CREATE TABLE response_brand_citations")
    expect(migration).toContain("ALTER TABLE tracking_projects ENABLE ROW LEVEL SECURITY")
    expect(migration).toContain("auth.uid()")

    expect(docs).toContain("# Brand Intelligence Schema")
    expect(docs).toContain("tracking_projects")
    expect(docs).toContain("brand_entities")
    expect(docs).toContain("prompt_run_responses")
    expect(docs).toContain("response_citations")
  })

  it("keeps a legacy-drop migration and per-table type files in place", () => {
    const dropMigrationPath = resolve(
      process.cwd(),
      "db/migrations/0003_drop_legacy_brand_tables.sql"
    )
    const onboardingAnalysisMigrationPath = resolve(
      process.cwd(),
      "db/migrations/0004_onboarding_site_analysis.sql"
    )
    const dropMigration = readFileSync(dropMigrationPath, "utf8")
    const onboardingAnalysisMigration = readFileSync(
      onboardingAnalysisMigrationPath,
      "utf8"
    )

    expect(dropMigration).toContain("DROP TABLE IF EXISTS brand_competitors")
    expect(dropMigration).toContain("DROP TABLE IF EXISTS brands")
    expect(onboardingAnalysisMigration).toContain("CREATE TABLE site_crawl_runs")
    expect(onboardingAnalysisMigration).toContain("CREATE TABLE site_crawl_pages")
    expect(onboardingAnalysisMigration).toContain(
      "ADD COLUMN IF NOT EXISTS variant_type"
    )

    for (const filePath of [
      "lib/tracking-projects/types.ts",
      "lib/brand-entities/types.ts",
      "lib/project-topics/types.ts",
      "lib/ai-platforms/types.ts",
      "lib/project-platforms/types.ts",
      "lib/prompt-catalog/types.ts",
      "lib/prompt-market-metrics/types.ts",
      "lib/tracked-prompts/types.ts",
      "lib/site-crawl-runs/types.ts",
      "lib/site-crawl-pages/types.ts",
      "lib/prompt-runs/types.ts",
      "lib/prompt-run-responses/types.ts",
      "lib/response-brand-metrics/types.ts",
      "lib/source-domains/types.ts",
      "lib/source-pages/types.ts",
      "lib/response-citations/types.ts",
      "lib/response-brand-citations/types.ts",
    ]) {
      expect(existsSync(resolve(process.cwd(), filePath))).toBe(true)
    }
  })
})
