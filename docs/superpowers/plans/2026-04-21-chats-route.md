# Chats Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/dashboard/chats` so users can browse every prompt run as a "chat" and drill into a single chat to see each platform's response, the brands it mentioned, and the sources it cited. One chat = one `prompt_runs` row; the detail view cycles through per-platform `prompt_run_responses` via a tab toggle.

**Architecture:** Client-side data layer mirroring the existing `PromptsPage` pattern. New `lib/chats/` module owns view models, pure filter logic, and PostgREST-backed repository queries. UI lives in `components/dashboard/chats/` and is composed from shadcn primitives. URL search params are the source of truth for filter state.

**Tech Stack:** Next.js 16 (App Router, Turbopack), React 19, Tailwind v4, radix-lyra shadcn registry, HugeIcons, Insforge SDK v1.2, `@tanstack/react-table` v8, `react-markdown` + `remark-gfm`, vitest.

---

## File Structure

**Created**

- `lib/chats/types.ts` — view models (ChatSummary, ChatDetail, ChatResponseView, ChatSource, ChatSourceGroup)
- `lib/chats/filters.ts` — `ChatFilters` type + `applyFilters` + URL serialization helpers
- `lib/chats/source-grouping.ts` — pure `groupSources` function
- `lib/chats/repository.ts` — `listChats`, `getChatDetail`, `listPipelineRunBatches`, `listProjectSourceDomains` + pure mapping helpers
- `lib/brand-entities/repository.ts` — `loadBrandEntitiesByProject` (new)
- `lib/ai-platforms/repository.ts` — `loadActiveAiPlatforms` (new)
- `tests/lib/chats-filters.test.ts`
- `tests/lib/chats-source-grouping.test.ts`
- `tests/lib/chats-repository.test.ts`
- `components/ui/tabs.tsx` — installed via shadcn CLI
- `components/ui/popover.tsx` — installed via shadcn CLI
- `components/ui/command.tsx` — installed via shadcn CLI
- `components/dashboard/chats/chats-page.tsx`
- `components/dashboard/chats/chats-filter-bar.tsx`
- `components/dashboard/chats/chats-list.tsx`
- `components/dashboard/chats/chats-list-row.tsx`
- `components/dashboard/chats/chat-detail-page.tsx`
- `components/dashboard/chats/chat-detail-header.tsx`
- `components/dashboard/chats/chat-platform-toggle.tsx`
- `components/dashboard/chats/chat-response-body.tsx`
- `components/dashboard/chats/chat-brands-panel.tsx`
- `components/dashboard/chats/chat-sources-section.tsx`
- `components/dashboard/chats/filters/pipeline-run-select.tsx`
- `components/dashboard/chats/filters/timeframe-select.tsx`
- `components/dashboard/chats/filters/topic-multi-select.tsx`
- `components/dashboard/chats/filters/prompt-multi-select.tsx`
- `components/dashboard/chats/filters/brand-multi-select.tsx`
- `components/dashboard/chats/filters/source-multi-select.tsx`
- `components/dashboard/chats/filters/search-input.tsx`
- `components/dashboard/chats/filters/multi-select-popover.tsx` — shared checkbox-list popover
- `app/dashboard/chats/[promptRunId]/page.tsx`
- `app/dashboard/chats/[promptRunId]/loading.tsx`

**Modified**

- `app/dashboard/chats/page.tsx` — render `<ChatsPage />` instead of the placeholder
- `app/dashboard/chats/loading.tsx` — tuned skeleton if needed
- `package.json` / `package-lock.json` — new deps
- `lib/brand-entities/` — add `repository.ts`

**No change** (referenced only)

- `lib/project-topics/repository.ts` — `loadProjectTopics`
- `lib/tracked-prompts/repository.ts` — `loadTrackedPromptsByProject`
- `lib/insforge/browser-client.ts` — `getInsforgeBrowserClient`
- `lib/brands/logo.ts` — `buildBrandLogoUrl` (for domain favicons)
- `components/auth-provider.tsx` — `useAuth`

---

## Task 1: Install dependencies

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install npm packages**

Run:
```bash
npm install react-markdown remark-gfm
```

Expected: both packages added to `package.json` under `dependencies`.

- [ ] **Step 2: Install shadcn Tabs primitive**

Run:
```bash
npx shadcn@latest add tabs --yes
```

Expected: creates `components/ui/tabs.tsx`. Accept any prompts with defaults.

- [ ] **Step 3: Install shadcn Popover primitive**

Run:
```bash
npx shadcn@latest add popover --yes
```

Expected: creates `components/ui/popover.tsx`.

- [ ] **Step 4: Install shadcn Command primitive**

Run:
```bash
npx shadcn@latest add command --yes
```

Expected: creates `components/ui/command.tsx`. May also add a transitive dep (`cmdk`).

- [ ] **Step 5: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json components/ui/tabs.tsx components/ui/popover.tsx components/ui/command.tsx
git commit -m "Add chats route dependencies and shadcn primitives"
```

---

## Task 2: View models (`lib/chats/types.ts`)

**Files:**
- Create: `lib/chats/types.ts`

- [ ] **Step 1: Create the file**

```ts
// lib/chats/types.ts
import type { AiPlatform } from "@/lib/ai-platforms/types"
import type { BrandEntity, BrandRole } from "@/lib/brand-entities/types"
import type { ProjectTopic } from "@/lib/project-topics/types"
import type {
  PromptRun,
  PromptRunStatus,
} from "@/lib/prompt-runs/types"
import type {
  PromptRunResponse,
  PromptRunResponseStatus,
} from "@/lib/prompt-run-responses/types"
import type { ResponseBrandMetric } from "@/lib/response-brand-metrics/types"
import type { ResponseCitation } from "@/lib/response-citations/types"
import type { SourceDomain } from "@/lib/source-domains/types"
import type { SourcePage } from "@/lib/source-pages/types"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

export type PlatformSummaryStatus = PromptRunResponseStatus | "missing"

export interface ChatPlatformSummary {
  code: string
  label: string
  status: PlatformSummaryStatus
  responseId: string | null
}

export interface ChatBrandMentionSummary {
  brandEntityId: string
  name: string
  role: BrandRole
}

export interface ChatSummary {
  promptRunId: string
  projectTopicId: string
  topicName: string
  trackedPromptId: string
  promptText: string
  scheduledFor: string
  completedAt: string | null
  status: PromptRunStatus
  platforms: ChatPlatformSummary[]
  brandMentions: ChatBrandMentionSummary[]
  sourceCount: number
}

export interface ChatBrandMention {
  brand: BrandEntity
  metric: ResponseBrandMetric
}

export interface ChatSource {
  citation: ResponseCitation
  page: SourcePage
  domain: SourceDomain
  matchedBrand: BrandEntity | null
}

export interface ChatSourceGroup {
  cited: ChatSource[]
  notCited: ChatSource[]
}

export interface ChatResponseView {
  response: PromptRunResponse
  platform: AiPlatform | null
  platformLabel: string
  brands: ChatBrandMention[]
  sources: ChatSourceGroup
}

export interface ChatDetail {
  promptRun: PromptRun
  topic: ProjectTopic
  trackedPrompt: TrackedPrompt
  responses: ChatResponseView[]
}

export interface PipelineRunBatch {
  date: string // YYYY-MM-DD
  count: number
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add lib/chats/types.ts
git commit -m "Add chat view model types"
```

---

## Task 3: Shared repository helpers (brand entities, AI platforms)

**Files:**
- Create: `lib/brand-entities/repository.ts`
- Create: `lib/ai-platforms/repository.ts`

- [ ] **Step 1: Implement brand entities loader**

```ts
// lib/brand-entities/repository.ts
import type { InsForgeClient } from "@insforge/sdk"

import type { BrandEntity } from "@/lib/brand-entities/types"

type BrandEntityClient = Pick<InsForgeClient, "database">

function takeRows<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

export async function loadBrandEntitiesByProject(
  client: BrandEntityClient,
  projectId: string
): Promise<BrandEntity[]> {
  const response = await client.database
    .from("brand_entities")
    .select("*")
    .eq("project_id", projectId)
    .eq("is_active", true)
    .order("role", { ascending: true })
    .order("sort_order", { ascending: true })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load brand entities.")
  }

  return takeRows(response.data as BrandEntity[] | BrandEntity | null)
}
```

- [ ] **Step 2: Implement AI platforms loader**

```ts
// lib/ai-platforms/repository.ts
import type { InsForgeClient } from "@insforge/sdk"

import type { AiPlatform } from "@/lib/ai-platforms/types"

type AiPlatformClient = Pick<InsForgeClient, "database">

function takeRows<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

export async function loadActiveAiPlatforms(
  client: AiPlatformClient
): Promise<AiPlatform[]> {
  const response = await client.database
    .from("ai_platforms")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load AI platforms.")
  }

  return takeRows(response.data as AiPlatform[] | AiPlatform | null)
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add lib/brand-entities/repository.ts lib/ai-platforms/repository.ts
git commit -m "Add brand entities and AI platforms repository helpers"
```

---

## Task 4: Source grouping (TDD)

**Files:**
- Create: `lib/chats/source-grouping.ts`
- Test: `tests/lib/chats-source-grouping.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/chats-source-grouping.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import { groupSources } from "@/lib/chats/source-grouping"
import type { BrandEntity } from "@/lib/brand-entities/types"
import type { ResponseCitation } from "@/lib/response-citations/types"
import type { SourceDomain } from "@/lib/source-domains/types"
import type { SourcePage } from "@/lib/source-pages/types"

function makeBrand(
  overrides: Partial<BrandEntity> & Pick<BrandEntity, "website_host">
): BrandEntity {
  return {
    created_at: "2026-04-01T00:00:00.000Z",
    description: "",
    id: `brand-${overrides.website_host}`,
    is_active: true,
    name: overrides.website_host,
    normalized_name: overrides.website_host,
    project_id: "project-1",
    role: "competitor",
    sort_order: 0,
    updated_at: "2026-04-01T00:00:00.000Z",
    website_url: `https://${overrides.website_host}`,
    ...overrides,
  }
}

function makeCitation(
  id: string,
  domainValue: string
): {
  citation: ResponseCitation
  page: SourcePage
  domain: SourceDomain
} {
  return {
    citation: {
      authority_score: null,
      cited_url: `https://${domainValue}/post`,
      citation_order: null,
      citation_text: null,
      created_at: "2026-04-01T00:00:00.000Z",
      id,
      project_id: "project-1",
      response_id: "response-1",
      source_page_id: `page-${id}`,
    },
    page: {
      canonical_url: `https://${domainValue}/post`,
      domain_id: `domain-${domainValue}`,
      first_seen_at: "2026-04-01T00:00:00.000Z",
      id: `page-${id}`,
      page_title: null,
    },
    domain: {
      created_at: "2026-04-01T00:00:00.000Z",
      display_name: null,
      domain: domainValue,
      id: `domain-${domainValue}`,
      root_domain: domainValue,
    },
  }
}

describe("groupSources", () => {
  const primary = makeBrand({ website_host: "vercel.com", role: "primary" })
  const competitor = makeBrand({
    website_host: "netlify.com",
    role: "competitor",
  })

  it("puts exact-host matches into cited", () => {
    const result = groupSources([makeCitation("c1", "vercel.com")], [primary])

    expect(result.cited).toHaveLength(1)
    expect(result.notCited).toHaveLength(0)
    expect(result.cited[0].matchedBrand?.id).toBe(primary.id)
  })

  it("matches subdomains of brand host", () => {
    const result = groupSources([makeCitation("c1", "docs.vercel.com")], [primary])

    expect(result.cited).toHaveLength(1)
    expect(result.cited[0].matchedBrand?.id).toBe(primary.id)
  })

  it("ignores www. prefix on the domain", () => {
    const result = groupSources([makeCitation("c1", "www.vercel.com")], [primary])

    expect(result.cited).toHaveLength(1)
  })

  it("is case-insensitive", () => {
    const result = groupSources([makeCitation("c1", "VERCEL.com")], [primary])

    expect(result.cited).toHaveLength(1)
  })

  it("puts non-matching domains into notCited", () => {
    const result = groupSources(
      [makeCitation("c1", "github.com"), makeCitation("c2", "reddit.com")],
      [primary]
    )

    expect(result.cited).toHaveLength(0)
    expect(result.notCited).toHaveLength(2)
    expect(result.notCited[0].matchedBrand).toBeNull()
  })

  it("matches any project brand (primary or competitor)", () => {
    const result = groupSources(
      [makeCitation("c1", "netlify.com")],
      [primary, competitor]
    )

    expect(result.cited).toHaveLength(1)
    expect(result.cited[0].matchedBrand?.id).toBe(competitor.id)
  })

  it("prefers the primary brand when multiple brands share a host prefix", () => {
    const result = groupSources(
      [makeCitation("c1", "vercel.com")],
      [competitor, primary]
    )

    expect(result.cited[0].matchedBrand?.role).toBe("primary")
  })

  it("puts everything in notCited when brands list is empty", () => {
    const result = groupSources([makeCitation("c1", "vercel.com")], [])

    expect(result.cited).toHaveLength(0)
    expect(result.notCited).toHaveLength(1)
  })

  it("treats empty domain strings as unmatched", () => {
    const result = groupSources([makeCitation("c1", "")], [primary])

    expect(result.notCited).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run:
```bash
npm test -- tests/lib/chats-source-grouping.test.ts
```

Expected: vitest fails with "Cannot find module '@/lib/chats/source-grouping'".

- [ ] **Step 3: Implement `groupSources`**

Create `lib/chats/source-grouping.ts`:

```ts
import type { BrandEntity } from "@/lib/brand-entities/types"
import type { ResponseCitation } from "@/lib/response-citations/types"
import type { SourceDomain } from "@/lib/source-domains/types"
import type { SourcePage } from "@/lib/source-pages/types"

import type { ChatSource, ChatSourceGroup } from "@/lib/chats/types"

interface RawSource {
  citation: ResponseCitation
  page: SourcePage
  domain: SourceDomain
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/^www\./, "")
}

function brandsByPriority(brands: BrandEntity[]): BrandEntity[] {
  return [...brands].sort((a, b) => {
    if (a.role === b.role) {
      return 0
    }

    return a.role === "primary" ? -1 : 1
  })
}

function matchBrand(
  domainHost: string,
  brands: BrandEntity[]
): BrandEntity | null {
  if (!domainHost) {
    return null
  }

  for (const brand of brandsByPriority(brands)) {
    const brandHost = normalizeHost(brand.website_host)

    if (!brandHost) {
      continue
    }

    if (domainHost === brandHost || domainHost.endsWith(`.${brandHost}`)) {
      return brand
    }
  }

  return null
}

export function groupSources(
  sources: RawSource[],
  brands: BrandEntity[]
): ChatSourceGroup {
  const cited: ChatSource[] = []
  const notCited: ChatSource[] = []

  for (const source of sources) {
    const host = normalizeHost(source.domain.domain)
    const matchedBrand = matchBrand(host, brands)

    const entry: ChatSource = {
      citation: source.citation,
      domain: source.domain,
      matchedBrand,
      page: source.page,
    }

    if (matchedBrand) {
      cited.push(entry)
    } else {
      notCited.push(entry)
    }
  }

  return { cited, notCited }
}
```

- [ ] **Step 4: Run tests, expect pass**

Run:
```bash
npm test -- tests/lib/chats-source-grouping.test.ts
```

Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/chats/source-grouping.ts tests/lib/chats-source-grouping.test.ts
git commit -m "Add pure source grouping for cited vs not-cited split"
```

---

## Task 5: Filters — predicates (TDD)

**Files:**
- Create: `lib/chats/filters.ts`
- Test: `tests/lib/chats-filters.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/chats-filters.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  applyFilters,
  emptyFilters,
  hasActiveFilters,
} from "@/lib/chats/filters"
import type { ChatSummary } from "@/lib/chats/types"

function makeSummary(overrides: Partial<ChatSummary> = {}): ChatSummary {
  return {
    brandMentions: [],
    completedAt: "2026-04-20T12:00:00.000Z",
    platforms: [],
    promptRunId: "run-1",
    promptText: "Best Next.js deployment platform?",
    projectTopicId: "topic-1",
    scheduledFor: "2026-04-20T10:00:00.000Z",
    sourceCount: 0,
    status: "completed",
    topicName: "Deployment",
    trackedPromptId: "prompt-1",
    ...overrides,
  }
}

describe("chat filters", () => {
  it("returns all rows when no filters are active", () => {
    const summaries = [makeSummary(), makeSummary({ promptRunId: "run-2" })]
    const result = applyFilters(summaries, emptyFilters())

    expect(result).toHaveLength(2)
  })

  it("filters by topic ids", () => {
    const summaries = [
      makeSummary({ projectTopicId: "topic-a" }),
      makeSummary({ projectTopicId: "topic-b", promptRunId: "run-2" }),
    ]

    const result = applyFilters(summaries, {
      ...emptyFilters(),
      topicIds: ["topic-a"],
    })

    expect(result).toHaveLength(1)
    expect(result[0].projectTopicId).toBe("topic-a")
  })

  it("filters by tracked prompt ids", () => {
    const summaries = [
      makeSummary({ trackedPromptId: "prompt-a" }),
      makeSummary({ trackedPromptId: "prompt-b", promptRunId: "run-2" }),
    ]

    const result = applyFilters(summaries, {
      ...emptyFilters(),
      trackedPromptIds: ["prompt-b"],
    })

    expect(result).toHaveLength(1)
    expect(result[0].trackedPromptId).toBe("prompt-b")
  })

  it("filters by brand ids", () => {
    const summaries = [
      makeSummary({
        brandMentions: [
          { brandEntityId: "brand-a", name: "A", role: "primary" },
        ],
      }),
      makeSummary({
        brandMentions: [
          { brandEntityId: "brand-b", name: "B", role: "competitor" },
        ],
        promptRunId: "run-2",
      }),
    ]

    const result = applyFilters(summaries, {
      ...emptyFilters(),
      brandEntityIds: ["brand-a"],
    })

    expect(result).toHaveLength(1)
    expect(result[0].promptRunId).toBe("run-1")
  })

  it("filters by pipeline run date (exact day)", () => {
    const summaries = [
      makeSummary({ scheduledFor: "2026-04-20T10:00:00.000Z" }),
      makeSummary({
        scheduledFor: "2026-04-21T10:00:00.000Z",
        promptRunId: "run-2",
      }),
    ]

    const result = applyFilters(summaries, {
      ...emptyFilters(),
      pipelineRunDate: "2026-04-21",
    })

    expect(result).toHaveLength(1)
    expect(result[0].promptRunId).toBe("run-2")
  })

  it("filters by timeframe 7d", () => {
    const now = Date.now()
    const recent = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()
    const old = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()

    const summaries = [
      makeSummary({ scheduledFor: recent }),
      makeSummary({ scheduledFor: old, promptRunId: "run-2" }),
    ]

    const result = applyFilters(summaries, {
      ...emptyFilters(),
      timeframe: "7d",
    })

    expect(result).toHaveLength(1)
    expect(result[0].promptRunId).toBe("run-1")
  })

  it("pipeline run date overrides timeframe", () => {
    const now = Date.now()
    const recent = new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString()

    const summaries = [
      makeSummary({ scheduledFor: recent }),
      makeSummary({
        scheduledFor: "2026-01-01T10:00:00.000Z",
        promptRunId: "run-2",
      }),
    ]

    const result = applyFilters(summaries, {
      ...emptyFilters(),
      pipelineRunDate: "2026-01-01",
      timeframe: "7d",
    })

    expect(result).toHaveLength(1)
    expect(result[0].promptRunId).toBe("run-2")
  })

  it("filters by free-text search on promptText (case-insensitive)", () => {
    const summaries = [
      makeSummary({ promptText: "Best Next.js deployment platform?" }),
      makeSummary({
        promptText: "How do I host a static site?",
        promptRunId: "run-2",
      }),
    ]

    const result = applyFilters(summaries, {
      ...emptyFilters(),
      search: "next.js",
    })

    expect(result).toHaveLength(1)
    expect(result[0].promptRunId).toBe("run-1")
  })

  it("hasActiveFilters is false for empty filters, true when any are set", () => {
    expect(hasActiveFilters(emptyFilters())).toBe(false)
    expect(
      hasActiveFilters({ ...emptyFilters(), topicIds: ["topic-a"] })
    ).toBe(true)
    expect(hasActiveFilters({ ...emptyFilters(), search: "x" })).toBe(true)
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run:
```bash
npm test -- tests/lib/chats-filters.test.ts
```

Expected: fails with module not found.

- [ ] **Step 3: Implement `filters.ts` (predicates first)**

Create `lib/chats/filters.ts`:

```ts
import type { ChatSummary } from "@/lib/chats/types"

export type ChatTimeframe = "today" | "7d" | "30d" | "90d" | "custom"

export interface ChatFilters {
  pipelineRunDate: string | null
  timeframe: ChatTimeframe | null
  customRange: { from: string; to: string } | null
  topicIds: string[]
  trackedPromptIds: string[]
  brandEntityIds: string[]
  sourceDomainIds: string[]
  search: string
}

const DAY_MS = 24 * 60 * 60 * 1000

export function emptyFilters(): ChatFilters {
  return {
    brandEntityIds: [],
    customRange: null,
    pipelineRunDate: null,
    search: "",
    sourceDomainIds: [],
    timeframe: null,
    topicIds: [],
    trackedPromptIds: [],
  }
}

export function hasActiveFilters(filters: ChatFilters): boolean {
  return (
    filters.pipelineRunDate !== null ||
    filters.timeframe !== null ||
    filters.customRange !== null ||
    filters.topicIds.length > 0 ||
    filters.trackedPromptIds.length > 0 ||
    filters.brandEntityIds.length > 0 ||
    filters.sourceDomainIds.length > 0 ||
    filters.search.trim().length > 0
  )
}

function toDay(dateString: string): string {
  return dateString.slice(0, 10)
}

function isWithinTimeframe(
  scheduledFor: string,
  timeframe: ChatTimeframe,
  customRange: ChatFilters["customRange"],
  now: number
): boolean {
  const ts = Date.parse(scheduledFor)

  if (Number.isNaN(ts)) {
    return false
  }

  if (timeframe === "custom") {
    if (!customRange) {
      return true
    }

    const from = Date.parse(customRange.from)
    const to = Date.parse(customRange.to)

    return ts >= from && ts <= to
  }

  const windowDays =
    timeframe === "today" ? 1 :
    timeframe === "7d" ? 7 :
    timeframe === "30d" ? 30 :
    timeframe === "90d" ? 90 :
    0

  return ts >= now - windowDays * DAY_MS
}

export function applyFilters(
  chats: ChatSummary[],
  filters: ChatFilters,
  now: number = Date.now()
): ChatSummary[] {
  const search = filters.search.trim().toLowerCase()
  const topicSet = new Set(filters.topicIds)
  const promptSet = new Set(filters.trackedPromptIds)
  const brandSet = new Set(filters.brandEntityIds)

  return chats.filter((chat) => {
    if (filters.pipelineRunDate) {
      if (toDay(chat.scheduledFor) !== filters.pipelineRunDate) {
        return false
      }
    } else if (filters.timeframe) {
      if (
        !isWithinTimeframe(
          chat.scheduledFor,
          filters.timeframe,
          filters.customRange,
          now
        )
      ) {
        return false
      }
    }

    if (topicSet.size > 0 && !topicSet.has(chat.projectTopicId)) {
      return false
    }

    if (promptSet.size > 0 && !promptSet.has(chat.trackedPromptId)) {
      return false
    }

    if (brandSet.size > 0) {
      const hasMatch = chat.brandMentions.some((mention) =>
        brandSet.has(mention.brandEntityId)
      )

      if (!hasMatch) {
        return false
      }
    }

    if (search && !chat.promptText.toLowerCase().includes(search)) {
      return false
    }

    return true
  })
}
```

- [ ] **Step 4: Run tests, expect pass**

Run:
```bash
npm test -- tests/lib/chats-filters.test.ts
```

Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/chats/filters.ts tests/lib/chats-filters.test.ts
git commit -m "Add chat filter predicates"
```

---

## Task 6: Filters — URL serialization (TDD)

**Files:**
- Modify: `lib/chats/filters.ts`
- Modify: `tests/lib/chats-filters.test.ts`

- [ ] **Step 1: Add the failing tests**

Append to `tests/lib/chats-filters.test.ts` (inside the same `describe("chat filters", ...)` block, before the closing `})`):

```ts
  describe("url serialization", () => {
    it("round-trips an empty filter set", () => {
      const qs = filtersToQueryString(emptyFilters())
      const parsed = filtersFromQueryString(new URLSearchParams(qs))

      expect(parsed).toEqual(emptyFilters())
    })

    it("round-trips a fully populated filter set", () => {
      const filters = {
        brandEntityIds: ["brand-a", "brand-b"],
        customRange: { from: "2026-04-01", to: "2026-04-15" },
        pipelineRunDate: null,
        search: "deploy next",
        sourceDomainIds: ["domain-1"],
        timeframe: "custom" as const,
        topicIds: ["topic-a"],
        trackedPromptIds: ["prompt-a", "prompt-b"],
      }

      const qs = filtersToQueryString(filters)
      const parsed = filtersFromQueryString(new URLSearchParams(qs))

      expect(parsed).toEqual(filters)
    })

    it("drops unknown timeframe values when parsing", () => {
      const parsed = filtersFromQueryString(
        new URLSearchParams("timeframe=bogus")
      )

      expect(parsed.timeframe).toBeNull()
    })

    it("drops unknown or malformed pipelineRunDate", () => {
      const parsed = filtersFromQueryString(
        new URLSearchParams("pipelineRunDate=not-a-date")
      )

      expect(parsed.pipelineRunDate).toBeNull()
    })
  })
```

Also add the import at the top of the file:

```ts
import {
  applyFilters,
  emptyFilters,
  filtersFromQueryString,
  filtersToQueryString,
  hasActiveFilters,
} from "@/lib/chats/filters"
```

(Replace the existing import block.)

- [ ] **Step 2: Run the test, expect failure**

Run: `npm test -- tests/lib/chats-filters.test.ts`
Expected: the new tests fail with "filtersToQueryString is not exported".

- [ ] **Step 3: Implement the serializers**

Append to `lib/chats/filters.ts`:

```ts
const TIMEFRAMES: ChatTimeframe[] = ["today", "7d", "30d", "90d", "custom"]

function isTimeframe(value: string | null): value is ChatTimeframe {
  return value !== null && (TIMEFRAMES as string[]).includes(value)
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
}

export function filtersToQueryString(filters: ChatFilters): string {
  const params = new URLSearchParams()

  if (filters.pipelineRunDate) {
    params.set("pipelineRunDate", filters.pipelineRunDate)
  }

  if (filters.timeframe) {
    params.set("timeframe", filters.timeframe)
  }

  if (filters.customRange) {
    params.set("from", filters.customRange.from)
    params.set("to", filters.customRange.to)
  }

  if (filters.topicIds.length > 0) {
    params.set("topics", filters.topicIds.join(","))
  }

  if (filters.trackedPromptIds.length > 0) {
    params.set("prompts", filters.trackedPromptIds.join(","))
  }

  if (filters.brandEntityIds.length > 0) {
    params.set("brands", filters.brandEntityIds.join(","))
  }

  if (filters.sourceDomainIds.length > 0) {
    params.set("sources", filters.sourceDomainIds.join(","))
  }

  if (filters.search.trim().length > 0) {
    params.set("q", filters.search.trim())
  }

  return params.toString()
}

function splitList(value: string | null): string[] {
  if (!value) {
    return []
  }

  return value
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
}

export function filtersFromQueryString(params: URLSearchParams): ChatFilters {
  const next = emptyFilters()

  const pipelineRunDate = params.get("pipelineRunDate")

  if (pipelineRunDate && isIsoDate(pipelineRunDate)) {
    next.pipelineRunDate = pipelineRunDate
  }

  const timeframe = params.get("timeframe")

  if (isTimeframe(timeframe)) {
    next.timeframe = timeframe
  }

  const from = params.get("from")
  const to = params.get("to")

  if (from && to && isIsoDate(from) && isIsoDate(to)) {
    next.customRange = { from, to }
  }

  next.topicIds = splitList(params.get("topics"))
  next.trackedPromptIds = splitList(params.get("prompts"))
  next.brandEntityIds = splitList(params.get("brands"))
  next.sourceDomainIds = splitList(params.get("sources"))
  next.search = params.get("q") ?? ""

  return next
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- tests/lib/chats-filters.test.ts`
Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/chats/filters.ts tests/lib/chats-filters.test.ts
git commit -m "Add chat filter URL serialization"
```

---

## Task 7: Repository — pure mappers (TDD)

**Files:**
- Create: `lib/chats/repository.ts` (first pass: pure mappers only)
- Test: `tests/lib/chats-repository.test.ts`

The repository has two layers: **query functions** (hit Insforge) and **mapping functions** (shape raw rows into view models). This task covers the mappers; Task 8 adds the query wrappers.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/chats-repository.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  mapChatSummaryRows,
  mapPipelineRunBatchRows,
} from "@/lib/chats/repository"
import type { AiPlatform } from "@/lib/ai-platforms/types"

const platforms: AiPlatform[] = [
  {
    code: "chatgpt",
    created_at: "2026-01-01T00:00:00.000Z",
    is_active: true,
    label: "ChatGPT",
    sort_order: 0,
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    code: "claude",
    created_at: "2026-01-01T00:00:00.000Z",
    is_active: true,
    label: "Claude",
    sort_order: 1,
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    code: "perplexity",
    created_at: "2026-01-01T00:00:00.000Z",
    is_active: true,
    label: "Perplexity",
    sort_order: 2,
    updated_at: "2026-01-01T00:00:00.000Z",
  },
]

function makeRawRun(overrides: Record<string, unknown> = {}) {
  return {
    cadence_applied: "daily",
    completed_at: "2026-04-20T12:00:00.000Z",
    created_at: "2026-04-20T10:00:00.000Z",
    failure_reason: null,
    id: "run-1",
    project_id: "project-1",
    project_topic_id: "topic-1",
    project_topics: { id: "topic-1", name: "Deployment" },
    prompt_run_responses: [
      {
        id: "resp-1",
        platform_code: "chatgpt",
        response_brand_metrics: [
          {
            brand_entities: {
              id: "brand-1",
              name: "Vercel",
              role: "primary",
            },
            brand_entity_id: "brand-1",
          },
        ],
        response_citations: [{ id: "cit-1" }, { id: "cit-2" }],
        status: "completed",
      },
      {
        id: "resp-2",
        platform_code: "claude",
        response_brand_metrics: [],
        response_citations: [],
        status: "completed",
      },
    ],
    scheduled_for: "2026-04-20T10:00:00.000Z",
    started_at: "2026-04-20T10:00:01.000Z",
    status: "completed",
    tracked_prompt_id: "prompt-1",
    tracked_prompts: {
      id: "prompt-1",
      prompt_text: "Best Next.js deployment platform?",
    },
    trigger_type: "scheduled",
    ...overrides,
  }
}

describe("mapChatSummaryRows", () => {
  it("builds a summary row with topic, prompt, platforms, brands, and source count", () => {
    const result = mapChatSummaryRows([makeRawRun()], platforms)

    expect(result).toHaveLength(1)
    const row = result[0]

    expect(row.promptRunId).toBe("run-1")
    expect(row.topicName).toBe("Deployment")
    expect(row.promptText).toBe("Best Next.js deployment platform?")
    expect(row.sourceCount).toBe(2)
    expect(row.brandMentions).toEqual([
      { brandEntityId: "brand-1", name: "Vercel", role: "primary" },
    ])
  })

  it("emits platforms in ai_platforms.sort_order with missing status when no response", () => {
    const result = mapChatSummaryRows([makeRawRun()], platforms)

    expect(result[0].platforms.map((p) => p.code)).toEqual([
      "chatgpt",
      "claude",
      "perplexity",
    ])
    expect(result[0].platforms[2].status).toBe("missing")
    expect(result[0].platforms[2].responseId).toBeNull()
  })

  it("deduplicates brand mentions across platform responses", () => {
    const run = makeRawRun({
      prompt_run_responses: [
        {
          id: "resp-1",
          platform_code: "chatgpt",
          response_brand_metrics: [
            {
              brand_entities: { id: "brand-1", name: "Vercel", role: "primary" },
              brand_entity_id: "brand-1",
            },
          ],
          response_citations: [],
          status: "completed",
        },
        {
          id: "resp-2",
          platform_code: "claude",
          response_brand_metrics: [
            {
              brand_entities: { id: "brand-1", name: "Vercel", role: "primary" },
              brand_entity_id: "brand-1",
            },
            {
              brand_entities: {
                id: "brand-2",
                name: "Netlify",
                role: "competitor",
              },
              brand_entity_id: "brand-2",
            },
          ],
          response_citations: [],
          status: "completed",
        },
      ],
    })

    const result = mapChatSummaryRows([run], platforms)

    expect(result[0].brandMentions).toHaveLength(2)
    expect(result[0].brandMentions.map((b) => b.brandEntityId).sort()).toEqual([
      "brand-1",
      "brand-2",
    ])
  })

  it("tolerates missing nested fields", () => {
    const run = makeRawRun({
      prompt_run_responses: null,
      project_topics: null,
      tracked_prompts: null,
    })

    const result = mapChatSummaryRows([run], platforms)

    expect(result[0].topicName).toBe("")
    expect(result[0].promptText).toBe("")
    expect(result[0].brandMentions).toEqual([])
    expect(result[0].sourceCount).toBe(0)
    expect(result[0].platforms.every((p) => p.status === "missing")).toBe(true)
  })
})

describe("mapPipelineRunBatchRows", () => {
  it("groups runs by scheduled_for date and counts them descending", () => {
    const rows = [
      { scheduled_for: "2026-04-20T09:00:00.000Z" },
      { scheduled_for: "2026-04-20T10:00:00.000Z" },
      { scheduled_for: "2026-04-21T11:00:00.000Z" },
    ]

    const result = mapPipelineRunBatchRows(rows)

    expect(result).toEqual([
      { count: 1, date: "2026-04-21" },
      { count: 2, date: "2026-04-20" },
    ])
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run: `npm test -- tests/lib/chats-repository.test.ts`
Expected: fails with module not found.

- [ ] **Step 3: Implement the mappers**

Create `lib/chats/repository.ts`:

```ts
import type { AiPlatform } from "@/lib/ai-platforms/types"
import type {
  ChatBrandMentionSummary,
  ChatPlatformSummary,
  ChatSummary,
  PipelineRunBatch,
} from "@/lib/chats/types"
import type { PromptRunResponseStatus } from "@/lib/prompt-run-responses/types"
import type { PromptRunStatus } from "@/lib/prompt-runs/types"

type RawBrandEntity = {
  id: string
  name: string
  role: "primary" | "competitor"
}

type RawBrandMetric = {
  brand_entity_id: string
  brand_entities: RawBrandEntity | null
}

type RawCitation = { id: string }

type RawResponse = {
  id: string
  platform_code: string
  status: PromptRunResponseStatus
  response_brand_metrics: RawBrandMetric[] | null
  response_citations: RawCitation[] | null
}

type RawRun = {
  id: string
  project_id: string
  project_topic_id: string
  tracked_prompt_id: string
  scheduled_for: string
  completed_at: string | null
  status: PromptRunStatus
  project_topics: { id: string; name: string } | null
  tracked_prompts: { id: string; prompt_text: string } | null
  prompt_run_responses: RawResponse[] | null
}

function toDay(iso: string): string {
  return iso.slice(0, 10)
}

function buildPlatforms(
  responses: RawResponse[],
  platforms: AiPlatform[]
): ChatPlatformSummary[] {
  const byCode = new Map<string, RawResponse>()

  for (const response of responses) {
    byCode.set(response.platform_code, response)
  }

  return [...platforms]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((platform) => {
      const response = byCode.get(platform.code)

      return {
        code: platform.code,
        label: platform.label,
        responseId: response?.id ?? null,
        status: response?.status ?? "missing",
      }
    })
}

function collectBrandMentions(
  responses: RawResponse[]
): ChatBrandMentionSummary[] {
  const seen = new Map<string, ChatBrandMentionSummary>()

  for (const response of responses) {
    for (const metric of response.response_brand_metrics ?? []) {
      if (!metric.brand_entities || seen.has(metric.brand_entity_id)) {
        continue
      }

      seen.set(metric.brand_entity_id, {
        brandEntityId: metric.brand_entity_id,
        name: metric.brand_entities.name,
        role: metric.brand_entities.role,
      })
    }
  }

  return [...seen.values()]
}

function countSources(responses: RawResponse[]): number {
  let total = 0

  for (const response of responses) {
    total += (response.response_citations ?? []).length
  }

  return total
}

export function mapChatSummaryRows(
  rows: RawRun[],
  platforms: AiPlatform[]
): ChatSummary[] {
  return rows.map((row) => {
    const responses = row.prompt_run_responses ?? []

    return {
      brandMentions: collectBrandMentions(responses),
      completedAt: row.completed_at,
      platforms: buildPlatforms(responses, platforms),
      promptRunId: row.id,
      promptText: row.tracked_prompts?.prompt_text ?? "",
      projectTopicId: row.project_topic_id,
      scheduledFor: row.scheduled_for,
      sourceCount: countSources(responses),
      status: row.status,
      topicName: row.project_topics?.name ?? "",
      trackedPromptId: row.tracked_prompt_id,
    }
  })
}

export function mapPipelineRunBatchRows(
  rows: Array<{ scheduled_for: string }>
): PipelineRunBatch[] {
  const counts = new Map<string, number>()

  for (const row of rows) {
    const date = toDay(row.scheduled_for)

    counts.set(date, (counts.get(date) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, count]) => ({ count, date }))
}
```

- [ ] **Step 4: Run tests, expect pass**

Run: `npm test -- tests/lib/chats-repository.test.ts`
Expected: all 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/chats/repository.ts tests/lib/chats-repository.test.ts
git commit -m "Add chat repository mapping helpers"
```

---

## Task 8: Repository — query functions

**Files:**
- Modify: `lib/chats/repository.ts`

- [ ] **Step 1: Add imports and query functions**

Merge the following imports into the existing import block at the top of `lib/chats/repository.ts` (add those not already present):

```ts
import type { InsForgeClient } from "@insforge/sdk"

import type { ChatFilters, ChatTimeframe } from "@/lib/chats/filters"
import { groupSources } from "@/lib/chats/source-grouping"
import type {
  ChatBrandMention,
  ChatDetail,
  ChatResponseView,
} from "@/lib/chats/types"
import type { BrandEntity } from "@/lib/brand-entities/types"
import type { ProjectTopic } from "@/lib/project-topics/types"
import type { PromptRun } from "@/lib/prompt-runs/types"
import type { PromptRunResponse } from "@/lib/prompt-run-responses/types"
import type { ResponseBrandMetric } from "@/lib/response-brand-metrics/types"
import type { ResponseCitation } from "@/lib/response-citations/types"
import type { SourceDomain } from "@/lib/source-domains/types"
import type { SourcePage } from "@/lib/source-pages/types"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"
```

Then append the query functions at the end of the file:

```ts
type ChatsClient = Pick<InsForgeClient, "database">

const DAY_MS = 24 * 60 * 60 * 1000

const TIMEFRAME_DAYS: Record<ChatTimeframe, number> = {
  "90d": 90,
  "30d": 30,
  "7d": 7,
  custom: 0,
  today: 1,
}

function buildScheduledRange(
  filters: ChatFilters,
  now: number
): { gte: string | null; lt: string | null } {
  if (filters.pipelineRunDate) {
    const start = new Date(`${filters.pipelineRunDate}T00:00:00.000Z`)
    const end = new Date(start.getTime() + DAY_MS)

    return { gte: start.toISOString(), lt: end.toISOString() }
  }

  if (!filters.timeframe) {
    return { gte: null, lt: null }
  }

  if (filters.timeframe === "custom" && filters.customRange) {
    return {
      gte: new Date(`${filters.customRange.from}T00:00:00.000Z`).toISOString(),
      lt: new Date(
        new Date(`${filters.customRange.to}T00:00:00.000Z`).getTime() + DAY_MS
      ).toISOString(),
    }
  }

  const days = TIMEFRAME_DAYS[filters.timeframe]

  if (!days) {
    return { gte: null, lt: null }
  }

  return {
    gte: new Date(now - days * DAY_MS).toISOString(),
    lt: null,
  }
}

function takeRows<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value
  }

  return value ? [value] : []
}

const SUMMARY_SELECT = `*,
  project_topics(id,name),
  tracked_prompts(id,prompt_text),
  prompt_run_responses(
    id, platform_code, status,
    response_brand_metrics(
      brand_entity_id,
      brand_entities(id, name, role)
    ),
    response_citations(id)
  )`

export async function listChatRuns(
  client: ChatsClient,
  input: {
    projectId: string
    filters: ChatFilters
    now?: number
  }
): Promise<RawRun[]> {
  const now = input.now ?? Date.now()
  const range = buildScheduledRange(input.filters, now)

  let query = client.database
    .from("prompt_runs")
    .select(SUMMARY_SELECT)
    .eq("project_id", input.projectId)

  if (range.gte) {
    query = query.gte("scheduled_for", range.gte)
  }

  if (range.lt) {
    query = query.lt("scheduled_for", range.lt)
  }

  if (input.filters.topicIds.length > 0) {
    query = query.in("project_topic_id", input.filters.topicIds)
  }

  if (input.filters.trackedPromptIds.length > 0) {
    query = query.in("tracked_prompt_id", input.filters.trackedPromptIds)
  }

  const response = await query.order("scheduled_for", { ascending: false })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load chats.")
  }

  return takeRows(response.data as RawRun[] | RawRun | null)
}

export async function listPipelineRunBatches(
  client: ChatsClient,
  projectId: string
): Promise<PipelineRunBatch[]> {
  const response = await client.database
    .from("prompt_runs")
    .select("scheduled_for")
    .eq("project_id", projectId)
    .order("scheduled_for", { ascending: false })

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load pipeline run batches.")
  }

  const rows = takeRows(
    response.data as Array<{ scheduled_for: string }> | null
  )

  return mapPipelineRunBatchRows(rows)
}

export async function listProjectSourceDomains(
  client: ChatsClient,
  projectId: string
): Promise<SourceDomain[]> {
  const response = await client.database
    .from("response_citations")
    .select("source_pages(source_domains(*))")
    .eq("project_id", projectId)

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load source domains.")
  }

  const rows = takeRows(
    response.data as Array<{
      source_pages: { source_domains: SourceDomain | null } | null
    }> | null
  )

  const seen = new Map<string, SourceDomain>()

  for (const row of rows) {
    const domain = row.source_pages?.source_domains ?? null

    if (domain && !seen.has(domain.id)) {
      seen.set(domain.id, domain)
    }
  }

  return [...seen.values()].sort((a, b) => a.domain.localeCompare(b.domain))
}

type DetailRawResponse = PromptRunResponse & {
  response_brand_metrics:
    | Array<
        ResponseBrandMetric & {
          brand_entities: BrandEntity | null
        }
      >
    | null
  response_citations:
    | Array<
        ResponseCitation & {
          source_pages:
            | (SourcePage & { source_domains: SourceDomain | null })
            | null
        }
      >
    | null
}

type DetailRawRun = PromptRun & {
  project_topics: ProjectTopic | null
  tracked_prompts: TrackedPrompt | null
  prompt_run_responses: DetailRawResponse[] | null
}

const DETAIL_SELECT = `*,
  project_topics(*),
  tracked_prompts(*),
  prompt_run_responses(
    *,
    response_brand_metrics(
      *,
      brand_entities(*)
    ),
    response_citations(
      *,
      source_pages(
        *,
        source_domains(*)
      )
    )
  )`

export async function getChatDetailRaw(
  client: ChatsClient,
  input: { projectId: string; promptRunId: string }
): Promise<DetailRawRun | null> {
  const response = await client.database
    .from("prompt_runs")
    .select(DETAIL_SELECT)
    .eq("project_id", input.projectId)
    .eq("id", input.promptRunId)
    .maybeSingle()

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to load chat detail.")
  }

  return (response.data as DetailRawRun | null) ?? null
}

export function buildChatDetail(
  raw: DetailRawRun,
  brands: BrandEntity[],
  platforms: AiPlatform[]
): ChatDetail | null {
  if (!raw.project_topics || !raw.tracked_prompts) {
    return null
  }

  const platformByCode = new Map(platforms.map((p) => [p.code, p]))
  const responses = raw.prompt_run_responses ?? []

  const views: ChatResponseView[] = responses
    .slice()
    .sort((a, b) => {
      const ao = platformByCode.get(a.platform_code)?.sort_order ?? 999
      const bo = platformByCode.get(b.platform_code)?.sort_order ?? 999

      return ao - bo
    })
    .map((response) => {
      const brandMentions: ChatBrandMention[] = (
        response.response_brand_metrics ?? []
      )
        .map((metric) => {
          if (!metric.brand_entities) {
            return null
          }

          return { brand: metric.brand_entities, metric }
        })
        .filter((value): value is ChatBrandMention => value !== null)

      const rawSources = (response.response_citations ?? [])
        .map((citation) => {
          const page = citation.source_pages

          if (!page || !page.source_domains) {
            return null
          }

          return {
            citation,
            domain: page.source_domains,
            page,
          }
        })
        .filter(
          (value): value is {
            citation: ResponseCitation
            page: SourcePage
            domain: SourceDomain
          } => value !== null
        )

      const platform = platformByCode.get(response.platform_code) ?? null

      return {
        brands: brandMentions,
        platform,
        platformLabel: platform?.label ?? response.platform_code,
        response,
        sources: groupSources(rawSources, brands),
      }
    })

  return {
    promptRun: raw,
    responses: views,
    topic: raw.project_topics,
    trackedPrompt: raw.tracked_prompts,
  }
}
```

Also export `listChats` and `getChatDetail` as high-level wrappers. Append:

```ts
export async function listChats(
  client: ChatsClient,
  input: {
    projectId: string
    filters: ChatFilters
    platforms: AiPlatform[]
    now?: number
  }
): Promise<ChatSummary[]> {
  const rawRuns = await listChatRuns(client, {
    filters: input.filters,
    now: input.now,
    projectId: input.projectId,
  })

  const summaries = mapChatSummaryRows(rawRuns, input.platforms)

  const brandSet = new Set(input.filters.brandEntityIds)

  const filteredByBrand =
    brandSet.size === 0
      ? summaries
      : summaries.filter((summary) =>
          summary.brandMentions.some((mention) =>
            brandSet.has(mention.brandEntityId)
          )
        )

  // Source-domain filter requires a secondary lookup — keep it off the
  // server query and apply it client-side when selected.
  if (input.filters.sourceDomainIds.length === 0) {
    return filteredByBrand
  }

  const sourceSet = new Set(input.filters.sourceDomainIds)
  const runIdsWithMatchingSource = await loadRunIdsWithSourceDomains(
    client,
    input.projectId,
    sourceSet
  )

  return filteredByBrand.filter((summary) =>
    runIdsWithMatchingSource.has(summary.promptRunId)
  )
}

async function loadRunIdsWithSourceDomains(
  client: ChatsClient,
  projectId: string,
  sourceDomainIds: Set<string>
): Promise<Set<string>> {
  if (sourceDomainIds.size === 0) {
    return new Set()
  }

  const response = await client.database
    .from("response_citations")
    .select(
      "prompt_run_responses(prompt_run_id),source_pages(domain_id)"
    )
    .eq("project_id", projectId)
    .in("source_pages.domain_id", [...sourceDomainIds])

  if (!response || response.error) {
    throw response?.error ?? new Error("Unable to filter by source domain.")
  }

  const rows = takeRows(
    response.data as Array<{
      prompt_run_responses: { prompt_run_id: string } | null
      source_pages: { domain_id: string } | null
    }> | null
  )

  const matches = new Set<string>()

  for (const row of rows) {
    if (
      row.source_pages &&
      sourceDomainIds.has(row.source_pages.domain_id) &&
      row.prompt_run_responses
    ) {
      matches.add(row.prompt_run_responses.prompt_run_id)
    }
  }

  return matches
}

export async function getChatDetail(
  client: ChatsClient,
  input: {
    projectId: string
    promptRunId: string
    brands: BrandEntity[]
    platforms: AiPlatform[]
  }
): Promise<ChatDetail | null> {
  const raw = await getChatDetailRaw(client, {
    projectId: input.projectId,
    promptRunId: input.promptRunId,
  })

  if (!raw) {
    return null
  }

  return buildChatDetail(raw, input.brands, input.platforms)
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Re-run full test suite**

Run: `npm test`
Expected: all existing tests still pass; repository mapping tests pass.

- [ ] **Step 4: Commit**

```bash
git add lib/chats/repository.ts
git commit -m "Add chat repository query functions"
```

---

## Task 9: Route shells

**Files:**
- Modify: `app/dashboard/chats/page.tsx`
- Modify: `app/dashboard/chats/loading.tsx`
- Create: `app/dashboard/chats/[promptRunId]/page.tsx`
- Create: `app/dashboard/chats/[promptRunId]/loading.tsx`

- [ ] **Step 1: Update list page**

Replace `app/dashboard/chats/page.tsx` with:

```tsx
import { ChatsPage } from "@/components/dashboard/chats/chats-page"

export default function Page() {
  return <ChatsPage />
}
```

- [ ] **Step 2: Leave the existing `loading.tsx` as-is**

The existing `DashboardPage title="Chats" isLoading` skeleton renders the same shell the new page will use, so no changes needed yet.

- [ ] **Step 3: Create detail loading skeleton**

Create `app/dashboard/chats/[promptRunId]/loading.tsx`:

```tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function ChatDetailLoading() {
  return (
    <div className="flex flex-1 flex-col p-4 pt-0">
      <Card className="min-h-[calc(100svh-6rem)]">
        <CardHeader className="space-y-3 border-b">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.4fr)]">
          <div className="space-y-4">
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
          <div className="space-y-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 4: Create detail page**

Create `app/dashboard/chats/[promptRunId]/page.tsx`:

```tsx
import { ChatDetailPage } from "@/components/dashboard/chats/chat-detail-page"

export default async function Page({
  params,
}: {
  params: Promise<{ promptRunId: string }>
}) {
  const { promptRunId } = await params

  return <ChatDetailPage promptRunId={promptRunId} />
}
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: fails because `ChatsPage` / `ChatDetailPage` don't exist yet. That's OK — we create them in subsequent tasks.

- [ ] **Step 6: Don't commit yet**

Skip committing until the referenced components exist (Tasks 10–19). We'll commit the route shells alongside them.

---

## Task 10: Shared multi-select popover

**Files:**
- Create: `components/dashboard/chats/filters/multi-select-popover.tsx`

- [ ] **Step 1: Implement**

```tsx
"use client"

import * as React from "react"
import {
  ArrowDown01Icon,
  Search01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface MultiSelectOption {
  value: string
  label: string
  description?: string
}

export function MultiSelectPopover({
  ariaLabel,
  disabled = false,
  emptyMessage = "No options",
  label,
  onChange,
  options,
  placeholder = "Search...",
  selected,
  triggerClassName,
}: {
  ariaLabel: string
  disabled?: boolean
  emptyMessage?: string
  label: string
  onChange: (next: string[]) => void
  options: MultiSelectOption[]
  placeholder?: string
  selected: string[]
  triggerClassName?: string
}) {
  const selectedSet = React.useMemo(() => new Set(selected), [selected])

  function toggle(value: string) {
    if (selectedSet.has(value)) {
      onChange(selected.filter((id) => id !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const count = selected.length
  const triggerLabel =
    count === 0 ? label : `${label} · ${count}`

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn("justify-between gap-2", triggerClassName)}
        >
          <span>{triggerLabel}</span>
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            strokeWidth={2}
            className="size-3.5"
          />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <div className="flex items-center border-b px-2">
            <HugeiconsIcon
              icon={Search01Icon}
              strokeWidth={2}
              className="mr-2 size-3.5 text-muted-foreground"
            />
            <CommandInput placeholder={placeholder} className="h-9 border-0" />
          </div>
          <CommandList>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedSet.has(option.value)

                return (
                  <CommandItem
                    key={option.value}
                    value={`${option.label} ${option.description ?? ""}`}
                    onSelect={() => toggle(option.value)}
                  >
                    <Checkbox
                      checked={isSelected}
                      className="mr-2"
                      aria-hidden
                      tabIndex={-1}
                    />
                    <div className="grid flex-1">
                      <span className="truncate text-sm">{option.label}</span>
                      {option.description ? (
                        <span className="truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      ) : null}
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: any earlier missing-module errors remain; no new type errors in this file.

- [ ] **Step 3: Don't commit yet**

Continue to the next filter components.

---

## Task 11: Individual filter components

**Files:**
- Create: `components/dashboard/chats/filters/pipeline-run-select.tsx`
- Create: `components/dashboard/chats/filters/timeframe-select.tsx`
- Create: `components/dashboard/chats/filters/topic-multi-select.tsx`
- Create: `components/dashboard/chats/filters/prompt-multi-select.tsx`
- Create: `components/dashboard/chats/filters/brand-multi-select.tsx`
- Create: `components/dashboard/chats/filters/source-multi-select.tsx`
- Create: `components/dashboard/chats/filters/search-input.tsx`

- [ ] **Step 1: Pipeline run select**

```tsx
// components/dashboard/chats/filters/pipeline-run-select.tsx
"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { PipelineRunBatch } from "@/lib/chats/types"

const ALL_VALUE = "__all__"

function formatDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00.000Z`)

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export function PipelineRunSelect({
  batches,
  onChange,
  value,
}: {
  batches: PipelineRunBatch[]
  onChange: (next: string | null) => void
  value: string | null
}) {
  return (
    <Select
      value={value ?? ALL_VALUE}
      onValueChange={(next) => onChange(next === ALL_VALUE ? null : next)}
    >
      <SelectTrigger className="h-9 w-44" aria-label="Pipeline run">
        <SelectValue placeholder="All pipeline runs" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>All pipeline runs</SelectItem>
        {batches.map((batch) => (
          <SelectItem key={batch.date} value={batch.date}>
            {formatDate(batch.date)} · {batch.count}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 2: Timeframe select**

```tsx
// components/dashboard/chats/filters/timeframe-select.tsx
"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ChatTimeframe } from "@/lib/chats/filters"

const ALL_VALUE = "__all__"
const OPTIONS: Array<{ label: string; value: ChatTimeframe }> = [
  { label: "Today", value: "today" },
  { label: "Last 7 days", value: "7d" },
  { label: "Last 30 days", value: "30d" },
  { label: "Last 90 days", value: "90d" },
]

export function TimeframeSelect({
  disabled = false,
  onChange,
  value,
}: {
  disabled?: boolean
  onChange: (next: ChatTimeframe | null) => void
  value: ChatTimeframe | null
}) {
  return (
    <Select
      disabled={disabled}
      value={value ?? ALL_VALUE}
      onValueChange={(next) =>
        onChange(next === ALL_VALUE ? null : (next as ChatTimeframe))
      }
    >
      <SelectTrigger className="h-9 w-40" aria-label="Time frame">
        <SelectValue placeholder="All time" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_VALUE}>All time</SelectItem>
        {OPTIONS.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
```

- [ ] **Step 3: Topic multi-select**

```tsx
// components/dashboard/chats/filters/topic-multi-select.tsx
"use client"

import {
  MultiSelectPopover,
  type MultiSelectOption,
} from "@/components/dashboard/chats/filters/multi-select-popover"
import type { ProjectTopic } from "@/lib/project-topics/types"

export function TopicMultiSelect({
  onChange,
  topics,
  value,
}: {
  onChange: (next: string[]) => void
  topics: ProjectTopic[]
  value: string[]
}) {
  const options: MultiSelectOption[] = topics.map((topic) => ({
    label: topic.name,
    value: topic.id,
  }))

  return (
    <MultiSelectPopover
      ariaLabel="Topic filter"
      emptyMessage="No topics"
      label="Topic"
      onChange={onChange}
      options={options}
      placeholder="Search topics..."
      selected={value}
      triggerClassName="w-36"
    />
  )
}
```

- [ ] **Step 4: Prompt multi-select (with topic cascade)**

```tsx
// components/dashboard/chats/filters/prompt-multi-select.tsx
"use client"

import {
  MultiSelectPopover,
  type MultiSelectOption,
} from "@/components/dashboard/chats/filters/multi-select-popover"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

export function PromptMultiSelect({
  onChange,
  prompts,
  topicIds,
  value,
}: {
  onChange: (next: string[]) => void
  prompts: TrackedPrompt[]
  topicIds: string[]
  value: string[]
}) {
  const topicSet = new Set(topicIds)

  const filtered = prompts.filter((prompt) => {
    if (!prompt.is_active) {
      return false
    }

    if (topicSet.size === 0) {
      return true
    }

    return topicSet.has(prompt.project_topic_id)
  })

  const options: MultiSelectOption[] = filtered.map((prompt) => ({
    label: prompt.prompt_text,
    value: prompt.id,
  }))

  return (
    <MultiSelectPopover
      ariaLabel="Prompt filter"
      emptyMessage="No prompts"
      label="Prompt"
      onChange={onChange}
      options={options}
      placeholder="Search prompts..."
      selected={value}
      triggerClassName="w-40"
    />
  )
}
```

- [ ] **Step 5: Brand multi-select**

```tsx
// components/dashboard/chats/filters/brand-multi-select.tsx
"use client"

import {
  MultiSelectPopover,
  type MultiSelectOption,
} from "@/components/dashboard/chats/filters/multi-select-popover"
import type { BrandEntity } from "@/lib/brand-entities/types"

export function BrandMultiSelect({
  brands,
  onChange,
  value,
}: {
  brands: BrandEntity[]
  onChange: (next: string[]) => void
  value: string[]
}) {
  const sorted = [...brands].sort((a, b) => {
    if (a.role === b.role) {
      return a.sort_order - b.sort_order
    }

    return a.role === "primary" ? -1 : 1
  })

  const options: MultiSelectOption[] = sorted.map((brand) => ({
    description: brand.role === "primary" ? "Primary" : "Competitor",
    label: brand.name,
    value: brand.id,
  }))

  return (
    <MultiSelectPopover
      ariaLabel="Brand filter"
      emptyMessage="No brands"
      label="Brand"
      onChange={onChange}
      options={options}
      placeholder="Search brands..."
      selected={value}
      triggerClassName="w-36"
    />
  )
}
```

- [ ] **Step 6: Source multi-select**

```tsx
// components/dashboard/chats/filters/source-multi-select.tsx
"use client"

import {
  MultiSelectPopover,
  type MultiSelectOption,
} from "@/components/dashboard/chats/filters/multi-select-popover"
import type { SourceDomain } from "@/lib/source-domains/types"

export function SourceMultiSelect({
  domains,
  onChange,
  value,
}: {
  domains: SourceDomain[]
  onChange: (next: string[]) => void
  value: string[]
}) {
  const options: MultiSelectOption[] = domains.map((domain) => ({
    label: domain.display_name ?? domain.domain,
    value: domain.id,
  }))

  return (
    <MultiSelectPopover
      ariaLabel="Source filter"
      emptyMessage="No sources"
      label="Source"
      onChange={onChange}
      options={options}
      placeholder="Search sources..."
      selected={value}
      triggerClassName="w-36"
    />
  )
}
```

- [ ] **Step 7: Search input**

```tsx
// components/dashboard/chats/filters/search-input.tsx
"use client"

import * as React from "react"
import { Search01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Input } from "@/components/ui/input"

export function SearchInput({
  onChange,
  value,
}: {
  onChange: (next: string) => void
  value: string
}) {
  const [local, setLocal] = React.useState(value)

  React.useEffect(() => {
    setLocal(value)
  }, [value])

  React.useEffect(() => {
    if (local === value) {
      return
    }

    const handle = window.setTimeout(() => {
      onChange(local)
    }, 200)

    return () => window.clearTimeout(handle)
  }, [local, onChange, value])

  return (
    <div className="relative w-full sm:w-64">
      <HugeiconsIcon
        icon={Search01Icon}
        strokeWidth={2}
        className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
      />
      <Input
        placeholder="Search prompts..."
        value={local}
        onChange={(event) => setLocal(event.target.value)}
        className="h-9 pl-8"
      />
    </div>
  )
}
```

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: only missing-module errors from tasks we haven't done yet; none inside these filter files.

- [ ] **Step 9: Don't commit yet**

---

## Task 12: Filter bar composition

**Files:**
- Create: `components/dashboard/chats/chats-filter-bar.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/dashboard/chats/chats-filter-bar.tsx
"use client"

import { Button } from "@/components/ui/button"
import { BrandMultiSelect } from "@/components/dashboard/chats/filters/brand-multi-select"
import { PipelineRunSelect } from "@/components/dashboard/chats/filters/pipeline-run-select"
import { PromptMultiSelect } from "@/components/dashboard/chats/filters/prompt-multi-select"
import { SearchInput } from "@/components/dashboard/chats/filters/search-input"
import { SourceMultiSelect } from "@/components/dashboard/chats/filters/source-multi-select"
import { TimeframeSelect } from "@/components/dashboard/chats/filters/timeframe-select"
import { TopicMultiSelect } from "@/components/dashboard/chats/filters/topic-multi-select"
import type { BrandEntity } from "@/lib/brand-entities/types"
import type { ChatFilters } from "@/lib/chats/filters"
import { emptyFilters, hasActiveFilters } from "@/lib/chats/filters"
import type { PipelineRunBatch } from "@/lib/chats/types"
import type { ProjectTopic } from "@/lib/project-topics/types"
import type { SourceDomain } from "@/lib/source-domains/types"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

export function ChatsFilterBar({
  batches,
  brands,
  domains,
  filters,
  onChange,
  prompts,
  topics,
}: {
  batches: PipelineRunBatch[]
  brands: BrandEntity[]
  domains: SourceDomain[]
  filters: ChatFilters
  onChange: (next: ChatFilters) => void
  prompts: TrackedPrompt[]
  topics: ProjectTopic[]
}) {
  const timeframeDisabled = filters.pipelineRunDate !== null

  function update<K extends keyof ChatFilters>(key: K, value: ChatFilters[K]) {
    onChange({ ...filters, [key]: value })
  }

  function handleTopicsChange(next: string[]) {
    const topicSet = new Set(next)
    const trackedPromptIds = filters.trackedPromptIds.filter((promptId) => {
      const prompt = prompts.find((candidate) => candidate.id === promptId)

      if (!prompt) {
        return false
      }

      if (topicSet.size === 0) {
        return true
      }

      return topicSet.has(prompt.project_topic_id)
    })

    onChange({ ...filters, topicIds: next, trackedPromptIds })
  }

  const active = hasActiveFilters(filters)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PipelineRunSelect
        batches={batches}
        onChange={(value) => update("pipelineRunDate", value)}
        value={filters.pipelineRunDate}
      />
      <TimeframeSelect
        disabled={timeframeDisabled}
        onChange={(value) => update("timeframe", value)}
        value={filters.timeframe}
      />
      <TopicMultiSelect
        onChange={handleTopicsChange}
        topics={topics}
        value={filters.topicIds}
      />
      <PromptMultiSelect
        onChange={(value) => update("trackedPromptIds", value)}
        prompts={prompts}
        topicIds={filters.topicIds}
        value={filters.trackedPromptIds}
      />
      <BrandMultiSelect
        brands={brands}
        onChange={(value) => update("brandEntityIds", value)}
        value={filters.brandEntityIds}
      />
      <SourceMultiSelect
        domains={domains}
        onChange={(value) => update("sourceDomainIds", value)}
        value={filters.sourceDomainIds}
      />
      <div className="ml-auto flex items-center gap-2">
        <SearchInput
          onChange={(value) => update("search", value)}
          value={filters.search}
        />
        {active ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange(emptyFilters())}
          >
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors inside this file.

- [ ] **Step 3: Don't commit yet**

---

## Task 13: Chats list row

**Files:**
- Create: `components/dashboard/chats/chats-list-row.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/dashboard/chats/chats-list-row.tsx
"use client"

import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import type { ChatSummary } from "@/lib/chats/types"

function formatScheduled(iso: string): string {
  const date = new Date(iso)

  return date.toLocaleString(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  })
}

function platformGlyph(status: ChatSummary["platforms"][number]["status"]): string {
  if (status === "completed") {
    return "✓"
  }

  if (status === "missing") {
    return "·"
  }

  return "✗"
}

export function ChatsListRow({
  chat,
  href,
}: {
  chat: ChatSummary
  href: string
}) {
  const completedPlatforms = chat.platforms.filter(
    (platform) => platform.status === "completed"
  ).length
  const totalPlatforms = chat.platforms.length
  const brandsToShow = chat.brandMentions.slice(0, 4)
  const extraBrands = Math.max(0, chat.brandMentions.length - brandsToShow.length)

  return (
    <Link
      href={href}
      className="block rounded-lg border border-border bg-background p-4 transition-colors hover:bg-muted/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <p className="line-clamp-2 text-sm font-medium">{chat.promptText}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{chat.topicName || "Untitled topic"}</Badge>
        <span>{formatScheduled(chat.scheduledFor)}</span>
        <span>
          {completedPlatforms}/{totalPlatforms} platforms{" "}
          <span aria-hidden className="tracking-widest">
            {chat.platforms.map((p) => platformGlyph(p.status)).join("")}
          </span>
        </span>
        <span>Sources: {chat.sourceCount}</span>
      </div>
      {brandsToShow.length > 0 ? (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {brandsToShow.map((brand) => (
            <Badge
              key={brand.brandEntityId}
              variant={brand.role === "primary" ? "default" : "secondary"}
              className="text-[10px]"
            >
              {brand.name}
            </Badge>
          ))}
          {extraBrands > 0 ? (
            <span className="text-xs text-muted-foreground">
              +{extraBrands}
            </span>
          ) : null}
        </div>
      ) : null}
    </Link>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors in this file.

- [ ] **Step 3: Don't commit yet**

---

## Task 14: Chats list + pagination

**Files:**
- Create: `components/dashboard/chats/chats-list.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/dashboard/chats/chats-list.tsx
"use client"

import * as React from "react"
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
} from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { ChatsListRow } from "@/components/dashboard/chats/chats-list-row"
import { Button } from "@/components/ui/button"
import type { ChatSummary } from "@/lib/chats/types"

const PAGE_SIZE = 25

export function ChatsList({
  chats,
  hrefForChat,
}: {
  chats: ChatSummary[]
  hrefForChat: (promptRunId: string) => string
}) {
  const [page, setPage] = React.useState(0)

  React.useEffect(() => {
    setPage(0)
  }, [chats])

  const pageCount = Math.max(1, Math.ceil(chats.length / PAGE_SIZE))
  const start = page * PAGE_SIZE
  const rows = chats.slice(start, start + PAGE_SIZE)

  if (chats.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No chats match these filters.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3">
        {rows.map((chat) => (
          <ChatsListRow
            key={chat.promptRunId}
            chat={chat}
            href={hrefForChat(chat.promptRunId)}
          />
        ))}
      </div>
      <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          Showing {rows.length} of {chats.length} chat
          {chats.length === 1 ? "" : "s"}
        </p>
        {pageCount > 1 ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => setPage((value) => Math.max(0, value - 1))}
              disabled={page === 0}
              aria-label="Previous page"
            >
              <HugeiconsIcon
                icon={ArrowLeft01Icon}
                strokeWidth={2}
                className="size-3.5"
              />
            </Button>
            <span className="px-2 tabular-nums">
              Page {page + 1} of {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() =>
                setPage((value) => Math.min(pageCount - 1, value + 1))
              }
              disabled={page === pageCount - 1}
              aria-label="Next page"
            >
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                strokeWidth={2}
                className="size-3.5"
              />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors in this file.

---

## Task 15: Chats page wiring

**Files:**
- Create: `components/dashboard/chats/chats-page.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/dashboard/chats/chats-page.tsx
"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"

import { useAuth } from "@/components/auth-provider"
import { ChatsFilterBar } from "@/components/dashboard/chats/chats-filter-bar"
import { ChatsList } from "@/components/dashboard/chats/chats-list"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { loadActiveAiPlatforms } from "@/lib/ai-platforms/repository"
import { loadBrandEntitiesByProject } from "@/lib/brand-entities/repository"
import type { BrandEntity } from "@/lib/brand-entities/types"
import {
  applyFilters,
  emptyFilters,
  filtersFromQueryString,
  filtersToQueryString,
  type ChatFilters,
} from "@/lib/chats/filters"
import {
  listChats,
  listPipelineRunBatches,
  listProjectSourceDomains,
} from "@/lib/chats/repository"
import type {
  ChatSummary,
  PipelineRunBatch,
} from "@/lib/chats/types"
import { getInsforgeBrowserClient } from "@/lib/insforge/browser-client"
import { loadProjectTopics } from "@/lib/project-topics/repository"
import type { ProjectTopic } from "@/lib/project-topics/types"
import type { SourceDomain } from "@/lib/source-domains/types"
import { loadTrackedPromptsByProject } from "@/lib/tracked-prompts/repository"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

export function ChatsPage() {
  const { brand } = useAuth()
  const projectId = brand?.id ?? null
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filters = React.useMemo<ChatFilters>(
    () => filtersFromQueryString(new URLSearchParams(searchParams.toString())),
    [searchParams]
  )

  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [chats, setChats] = React.useState<ChatSummary[]>([])
  const [topics, setTopics] = React.useState<ProjectTopic[]>([])
  const [prompts, setPrompts] = React.useState<TrackedPrompt[]>([])
  const [brands, setBrands] = React.useState<BrandEntity[]>([])
  const [domains, setDomains] = React.useState<SourceDomain[]>([])
  const [batches, setBatches] = React.useState<PipelineRunBatch[]>([])

  React.useEffect(() => {
    if (!projectId) {
      return
    }

    let cancelled = false
    const client = getInsforgeBrowserClient()

    async function load(currentProjectId: string) {
      setIsLoading(true)
      setError(null)

      try {
        const platformList = await loadActiveAiPlatforms(client)

        const [
          loadedTopics,
          loadedPrompts,
          loadedBrands,
          loadedDomains,
          loadedBatches,
        ] = await Promise.all([
          loadProjectTopics(client, currentProjectId),
          loadTrackedPromptsByProject(client, currentProjectId),
          loadBrandEntitiesByProject(client, currentProjectId),
          listProjectSourceDomains(client, currentProjectId),
          listPipelineRunBatches(client, currentProjectId),
        ])

        const loadedChats = await listChats(client, {
          filters,
          platforms: platformList,
          projectId: currentProjectId,
        })

        if (cancelled) {
          return
        }

        setTopics(loadedTopics.filter((topic) => topic.is_active))
        setPrompts(loadedPrompts)
        setBrands(loadedBrands)
        setDomains(loadedDomains)
        setBatches(loadedBatches)
        setChats(loadedChats)
      } catch (caught) {
        if (cancelled) {
          return
        }

        setError(
          caught instanceof Error ? caught.message : "Unable to load chats."
        )
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load(projectId)

    return () => {
      cancelled = true
    }
  }, [projectId, filters])

  const filteredChats = React.useMemo(
    () => applyFilters(chats, filters),
    [chats, filters]
  )

  function setFilters(next: ChatFilters) {
    const qs = filtersToQueryString(next)

    router.replace(qs ? `${pathname}?${qs}` : pathname)
  }

  function hrefForChat(promptRunId: string): string {
    const qs = searchParams.toString()

    return qs
      ? `/dashboard/chats/${promptRunId}?${qs}`
      : `/dashboard/chats/${promptRunId}`
  }

  return (
    <div className="flex flex-1 flex-col p-4 pt-0">
      <Card className="min-h-[calc(100svh-6rem)]">
        <CardHeader>
          <CardTitle className="text-2xl">Chats</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ChatsFilterBar
            batches={batches}
            brands={brands}
            domains={domains}
            filters={filters}
            onChange={setFilters}
            prompts={prompts}
            topics={topics}
          />

          {error ? (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          ) : isLoading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <ChatsList chats={filteredChats} hrefForChat={hrefForChat} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors in this file.

- [ ] **Step 3: Commit list-side work**

```bash
git add app/dashboard/chats/page.tsx \
        app/dashboard/chats/[promptRunId]/page.tsx \
        app/dashboard/chats/[promptRunId]/loading.tsx \
        components/dashboard/chats/chats-page.tsx \
        components/dashboard/chats/chats-list.tsx \
        components/dashboard/chats/chats-list-row.tsx \
        components/dashboard/chats/chats-filter-bar.tsx \
        components/dashboard/chats/filters/
git commit -m "Add chats list page with filters"
```

(Detail page still won't compile until the next batch of tasks — that's expected.)

---

## Task 16: Chat detail header and platform toggle

**Files:**
- Create: `components/dashboard/chats/chat-detail-header.tsx`
- Create: `components/dashboard/chats/chat-platform-toggle.tsx`

- [ ] **Step 1: Detail header**

```tsx
// components/dashboard/chats/chat-detail-header.tsx
"use client"

import Link from "next/link"
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import type { ProjectTopic } from "@/lib/project-topics/types"
import type { PromptRun } from "@/lib/prompt-runs/types"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

function formatScheduled(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  })
}

export function ChatDetailHeader({
  backHref,
  promptRun,
  topic,
  trackedPrompt,
}: {
  backHref: string
  promptRun: PromptRun
  topic: ProjectTopic
  trackedPrompt: TrackedPrompt
}) {
  return (
    <div className="flex flex-col gap-3">
      <Link
        href={backHref}
        className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <HugeiconsIcon
          icon={ArrowLeft01Icon}
          strokeWidth={2}
          className="size-3.5"
        />
        Back to chats
      </Link>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{topic.name}</Badge>
        <span>Scheduled {formatScheduled(promptRun.scheduled_for)}</span>
      </div>
      <h1 className="text-xl font-semibold tracking-tight">
        {trackedPrompt.prompt_text}
      </h1>
    </div>
  )
}
```

- [ ] **Step 2: Platform toggle**

```tsx
// components/dashboard/chats/chat-platform-toggle.tsx
"use client"

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ChatResponseView } from "@/lib/chats/types"

export function ChatPlatformToggle({
  activeCode,
  onChange,
  responses,
}: {
  activeCode: string
  onChange: (code: string) => void
  responses: ChatResponseView[]
}) {
  if (responses.length === 0) {
    return null
  }

  return (
    <Tabs value={activeCode} onValueChange={onChange}>
      <TabsList>
        {responses.map((view) => (
          <TabsTrigger key={view.response.id} value={view.response.platform_code}>
            {view.platformLabel}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors in these files.

- [ ] **Step 4: Don't commit yet**

---

## Task 17: Chat response body (markdown)

**Files:**
- Create: `components/dashboard/chats/chat-response-body.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/dashboard/chats/chat-response-body.tsx
"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Badge } from "@/components/ui/badge"
import type { ChatResponseView } from "@/lib/chats/types"

function formatResponded(iso: string | null): string {
  if (!iso) {
    return "—"
  }

  return new Date(iso).toLocaleString(undefined, {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
  })
}

export function ChatResponseBody({ view }: { view: ChatResponseView }) {
  const { response } = view

  if (response.status !== "completed") {
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <p className="font-medium">
          {view.platformLabel} · {response.status.replace(/_/g, " ")}
        </p>
        {response.error_message ? (
          <p className="mt-2 text-muted-foreground">{response.error_message}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">{view.platformLabel}</Badge>
        {response.provider_model ? (
          <span>{response.provider_model}</span>
        ) : null}
        <span>Responded {formatResponded(response.responded_at)}</span>
        {response.latency_ms !== null ? (
          <span>{response.latency_ms} ms</span>
        ) : null}
      </div>
      <article className="prose prose-neutral max-w-none text-sm dark:prose-invert">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {response.raw_response_text ?? ""}
        </ReactMarkdown>
      </article>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Don't commit yet**

---

## Task 18: Chat brands panel

**Files:**
- Create: `components/dashboard/chats/chat-brands-panel.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/dashboard/chats/chat-brands-panel.tsx
"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { ChatBrandMention } from "@/lib/chats/types"

function formatScore(score: number | null): string {
  if (score === null) {
    return "—"
  }

  return score.toFixed(1)
}

function formatRank(rank: number | null): string {
  if (rank === null) {
    return "—"
  }

  return `#${rank}`
}

function sortMentions(mentions: ChatBrandMention[]): ChatBrandMention[] {
  return [...mentions].sort((a, b) => {
    if (a.brand.role !== b.brand.role) {
      return a.brand.role === "primary" ? -1 : 1
    }

    const aRank = a.metric.rank_position ?? Number.MAX_SAFE_INTEGER
    const bRank = b.metric.rank_position ?? Number.MAX_SAFE_INTEGER

    return aRank - bRank
  })
}

export function ChatBrandsPanel({
  mentions,
}: {
  mentions: ChatBrandMention[]
}) {
  const sorted = sortMentions(mentions)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Brands</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {sorted.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No brand mentions detected.
          </p>
        ) : (
          sorted.map(({ brand, metric }) => (
            <div
              key={brand.id}
              className="flex flex-col gap-1 rounded-md border border-border p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-medium">
                  {brand.name}
                </span>
                {brand.role === "primary" ? (
                  <Badge variant="default" className="text-[10px]">
                    Primary
                  </Badge>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span>Rank {formatRank(metric.rank_position)}</span>
                <span>Vis {formatScore(metric.visibility_score)}</span>
                <span>Cit {formatScore(metric.citation_score)}</span>
                <span>Sent {metric.sentiment_label}</span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Don't commit yet**

---

## Task 19: Chat sources section

**Files:**
- Create: `components/dashboard/chats/chat-sources-section.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/dashboard/chats/chat-sources-section.tsx
"use client"

import { LinkSquare01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { Badge } from "@/components/ui/badge"
import type { ChatSource, ChatSourceGroup } from "@/lib/chats/types"

function sortByOrder(sources: ChatSource[]): ChatSource[] {
  return [...sources].sort((a, b) => {
    const ao = a.citation.citation_order ?? Number.MAX_SAFE_INTEGER
    const bo = b.citation.citation_order ?? Number.MAX_SAFE_INTEGER

    return ao - bo
  })
}

function SourceLink({ source }: { source: ChatSource }) {
  const title = source.page.page_title ?? source.page.canonical_url

  return (
    <li className="flex flex-col gap-1 rounded-md border border-border p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-medium">{title}</span>
        {source.matchedBrand ? (
          <Badge
            variant={
              source.matchedBrand.role === "primary" ? "default" : "secondary"
            }
            className="text-[10px]"
          >
            {source.matchedBrand.name}
          </Badge>
        ) : null}
      </div>
      <a
        href={source.citation.cited_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        <HugeiconsIcon
          icon={LinkSquare01Icon}
          strokeWidth={2}
          className="size-3"
        />
        <span className="truncate">{source.domain.domain}</span>
      </a>
    </li>
  )
}

export function ChatSourcesSection({ group }: { group: ChatSourceGroup }) {
  const cited = sortByOrder(group.cited)
  const notCited = sortByOrder(group.notCited)

  if (cited.length === 0 && notCited.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
        No citations recorded.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Cited project brands ({cited.length})
        </h3>
        {cited.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No sources cited your brand or competitors.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {cited.map((source) => (
              <SourceLink key={source.citation.id} source={source} />
            ))}
          </ul>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Did not cite ({notCited.length})
        </h3>
        {notCited.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Every cited source matched a project brand.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {notCited.map((source) => (
              <SourceLink key={source.citation.id} source={source} />
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Don't commit yet**

---

## Task 20: Chat detail page wiring

**Files:**
- Create: `components/dashboard/chats/chat-detail-page.tsx`

- [ ] **Step 1: Implement**

```tsx
// components/dashboard/chats/chat-detail-page.tsx
"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"

import { useAuth } from "@/components/auth-provider"
import { ChatBrandsPanel } from "@/components/dashboard/chats/chat-brands-panel"
import { ChatDetailHeader } from "@/components/dashboard/chats/chat-detail-header"
import { ChatPlatformToggle } from "@/components/dashboard/chats/chat-platform-toggle"
import { ChatResponseBody } from "@/components/dashboard/chats/chat-response-body"
import { ChatSourcesSection } from "@/components/dashboard/chats/chat-sources-section"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { loadActiveAiPlatforms } from "@/lib/ai-platforms/repository"
import { loadBrandEntitiesByProject } from "@/lib/brand-entities/repository"
import { getChatDetail } from "@/lib/chats/repository"
import type { ChatDetail } from "@/lib/chats/types"
import { getInsforgeBrowserClient } from "@/lib/insforge/browser-client"

export function ChatDetailPage({
  promptRunId,
}: {
  promptRunId: string
}) {
  const { brand } = useAuth()
  const projectId = brand?.id ?? null
  const searchParams = useSearchParams()

  const [detail, setDetail] = React.useState<ChatDetail | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [activePlatform, setActivePlatform] = React.useState<string | null>(
    null
  )

  React.useEffect(() => {
    if (!projectId) {
      return
    }

    let cancelled = false
    const client = getInsforgeBrowserClient()

    async function load(currentProjectId: string) {
      setIsLoading(true)
      setError(null)

      try {
        const [platforms, brands] = await Promise.all([
          loadActiveAiPlatforms(client),
          loadBrandEntitiesByProject(client, currentProjectId),
        ])

        const loaded = await getChatDetail(client, {
          brands,
          platforms,
          projectId: currentProjectId,
          promptRunId,
        })

        if (cancelled) {
          return
        }

        setDetail(loaded)
        setActivePlatform(
          loaded?.responses[0]?.response.platform_code ?? null
        )
      } catch (caught) {
        if (cancelled) {
          return
        }

        setError(
          caught instanceof Error ? caught.message : "Unable to load chat."
        )
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void load(projectId)

    return () => {
      cancelled = true
    }
  }, [projectId, promptRunId])

  const backHref = React.useMemo(() => {
    const qs = searchParams.toString()

    return qs ? `/dashboard/chats?${qs}` : "/dashboard/chats"
  }, [searchParams])

  if (error) {
    return (
      <div className="flex flex-1 flex-col p-4 pt-0">
        <Card className="min-h-[calc(100svh-6rem)]">
          <CardHeader>
            <CardTitle className="text-2xl">Chat</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading || !detail) {
    return (
      <div className="flex flex-1 flex-col p-4 pt-0">
        <Card className="min-h-[calc(100svh-6rem)]">
          <CardHeader>
            <Skeleton className="h-6 w-2/3" />
          </CardHeader>
          <CardContent className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.4fr)]">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    )
  }

  const activeView =
    detail.responses.find(
      (view) => view.response.platform_code === activePlatform
    ) ?? detail.responses[0]

  return (
    <div className="flex flex-1 flex-col p-4 pt-0">
      <Card className="min-h-[calc(100svh-6rem)]">
        <CardHeader className="space-y-4 border-b">
          <ChatDetailHeader
            backHref={backHref}
            promptRun={detail.promptRun}
            topic={detail.topic}
            trackedPrompt={detail.trackedPrompt}
          />
        </CardHeader>
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.4fr)]">
          <div className="flex flex-col gap-4">
            <ChatPlatformToggle
              activeCode={activeView?.response.platform_code ?? ""}
              onChange={setActivePlatform}
              responses={detail.responses}
            />
            {activeView ? (
              <>
                <ChatResponseBody view={activeView} />
                <ChatSourcesSection group={activeView.sources} />
              </>
            ) : (
              <div className="rounded-md border border-dashed border-border p-12 text-center text-sm text-muted-foreground">
                No responses yet.
              </div>
            )}
          </div>
          <ChatBrandsPanel mentions={activeView?.brands ?? []} />
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit detail-side work**

```bash
git add components/dashboard/chats/chat-detail-page.tsx \
        components/dashboard/chats/chat-detail-header.tsx \
        components/dashboard/chats/chat-platform-toggle.tsx \
        components/dashboard/chats/chat-response-body.tsx \
        components/dashboard/chats/chat-brands-panel.tsx \
        components/dashboard/chats/chat-sources-section.tsx
git commit -m "Add chat detail page with platform toggle, brands, and sources"
```

---

## Task 21: Final verification

**Files:**
- No new files.

- [ ] **Step 1: Run the full test suite**

Run:
```bash
npm test
```

Expected: all tests pass (pre-existing + new `chats-*.test.ts`).

- [ ] **Step 2: Run the linter**

Run:
```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 3: Run typecheck**

Run:
```bash
npm run typecheck
```

Expected: exits 0.

- [ ] **Step 4: Smoke test in the browser**

Start the dev server:
```bash
npm run dev
```

Log in, open `/dashboard/chats`, and verify:
- Filter bar renders with all 7 filters.
- Picking a pipeline run disables the timeframe dropdown.
- Topic selection narrows the Prompt dropdown options.
- Clicking a row navigates to `/dashboard/chats/[promptRunId]` with filters preserved in the URL.
- Detail page cycles through platform tabs, brands panel updates per platform, sources split between "Cited" and "Did not cite".
- Back link returns to list with filters intact.
- A prompt_run with a failed response shows the status + error message in that tab but doesn't break the page.

If any check fails, diagnose and iterate before moving on.

- [ ] **Step 5: Commit verification-time tweaks (if any)**

If any small fixes were needed during smoke test:
```bash
git add <files>
git commit -m "Fix chats route smoke-test issues"
```

If nothing needed fixing, skip this step.

---

## Self-Review Checklist

Before handing off for execution, the plan author should confirm each spec section has an implementing task:

| Spec section | Task(s) |
|--------------|---------|
| Goal | Tasks 9, 15, 20 |
| View models | Task 2 |
| Filters (predicates) | Task 5 |
| Filters (URL serialization) | Task 6 |
| Repository (mappers) | Task 7 |
| Repository (queries) | Task 8 |
| Source grouping | Task 4 |
| Routes & file layout | Task 9 |
| List page UI | Tasks 13, 14, 15 |
| Filter bar UI | Tasks 10, 11, 12 |
| Detail page UI | Tasks 16–20 |
| Markdown rendering | Task 17 (react-markdown via Task 1) |
| Brands panel | Task 18 |
| Sources split UI | Task 19 |
| Edge cases (queued/failed, empty states) | Tasks 13, 14, 17, 18, 19 |
| Error handling | Tasks 15, 20 |
| Unit tests | Tasks 4, 5, 6, 7 |
| Dependencies | Task 1 |
| Final verification | Task 21 |

No gaps.
