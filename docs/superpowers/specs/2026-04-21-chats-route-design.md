# Chats Route Design

**Date:** 2026-04-21
**Owner:** sushii2
**Status:** Approved (pending implementation)

## Goal

Build `/dashboard/chats` so users can browse every prompt run as a "chat" and drill into a single chat to see each platform's response, the brands it mentioned, and the sources it cited. One chat corresponds to one `prompt_runs` row; the detail view cycles through the per-platform `prompt_run_responses` behind a toggle.

## Scope

In scope:

- List page at `/dashboard/chats` with filter bar + paginated rows.
- Detail page at `/dashboard/chats/[promptRunId]` with platform toggle, response body, brands panel, and sources split.
- New data layer in `lib/chats/` — view models, repository queries, pure filter logic.
- `react-markdown` + `remark-gfm` for rendering response bodies.
- URL-synced filter state so chats can be bookmarked/shared.
- Unit tests for filter logic, repository mapping, and source grouping.

Out of scope:

- Editing chat content, comments, tags.
- Exporting chats (CSV/PDF).
- Cross-project view.
- Realtime updates while a run is executing (Trigger.dev realtime is a future extension).
- React component integration tests (the repo has no jsdom-based dashboard tests yet; adding that scaffolding would exceed scope).

## Data model (existing, unchanged)

Chats are derived from these tables:

- `prompt_runs` — one per prompt × execution (the "chat" row).
- `prompt_run_responses` — one per `(prompt_run_id, platform_code)` with `raw_response_text`, `provider_model`, status.
- `response_brand_metrics` — per-response, per-brand rank / sentiment / visibility / citation score.
- `response_citations` → `source_pages` → `source_domains` — the sources.
- `brand_entities` — project's primary + competitors (with `website_host`).
- `project_topics`, `tracked_prompts`, `ai_platforms` — lookups.

No schema migrations are needed.

## View models (`lib/chats/types.ts`)

```ts
export interface ChatSummary {
  promptRunId: string
  projectTopicId: string
  topicName: string
  trackedPromptId: string
  promptText: string
  scheduledFor: string
  completedAt: string | null
  status: PromptRunStatus
  platforms: Array<{
    code: string
    label: string
    status: PromptRunResponseStatus | "missing"
    responseId: string | null
  }>
  brandMentions: Array<{
    brandEntityId: string
    name: string
    role: BrandRole
  }>
  sourceCount: number
}

export interface ChatDetail {
  promptRun: PromptRun
  topic: ProjectTopic
  trackedPrompt: TrackedPrompt
  responses: ChatResponseView[]
}

export interface ChatResponseView {
  response: PromptRunResponse
  platformLabel: string
  brands: Array<{
    brand: BrandEntity
    metric: ResponseBrandMetric
  }>
  sources: ChatSourceGroup
}

export interface ChatSourceGroup {
  cited: ChatSource[]     // citations hitting a project brand's domain
  notCited: ChatSource[]
}

export interface ChatSource {
  citation: ResponseCitation
  page: SourcePage
  domain: SourceDomain
  matchedBrand: BrandEntity | null   // which project brand matched, if any
}
```

## Filters (`lib/chats/filters.ts`)

```ts
export interface ChatFilters {
  pipelineRunDate: string | null       // YYYY-MM-DD; mutually exclusive with timeframe
  timeframe: "today" | "7d" | "30d" | "90d" | "custom" | null
  customRange: { from: string; to: string } | null
  topicIds: string[]                   // multi
  trackedPromptIds: string[]           // multi, cascades from topicIds
  brandEntityIds: string[]             // multi
  sourceDomainIds: string[]            // multi
  search: string                       // debounced, client-side
}

export function applyFilters(chats: ChatSummary[], filters: ChatFilters): ChatSummary[]
export function filtersToQueryString(filters: ChatFilters): string
export function filtersFromQueryString(qs: URLSearchParams): ChatFilters
export function emptyFilters(): ChatFilters
export function hasActiveFilters(filters: ChatFilters): boolean
```

**Rules:**

- Selecting a pipeline run date overrides the timeframe filter (UI disables timeframe with tooltip).
- `trackedPromptIds` is validated against `topicIds` on each change — IDs outside the selected topics are dropped.
- `search` matches `promptText` (case-insensitive) and is kept out of the server query (client-side only).
- URL param references that no longer exist in the project (deleted topic/prompt/brand/source) are silently dropped on deserialize.

## Repository (`lib/chats/repository.ts`)

Single-query PostgREST nested selects, one pure mapping function per shape.

```ts
listChats(
  client: InsForgeClient,
  input: { projectId: string; filters: ChatFilters }
): Promise<ChatSummary[]>

getChatDetail(
  client: InsForgeClient,
  input: { projectId: string; promptRunId: string }
): Promise<ChatDetail | null>

listPipelineRunBatches(
  client: InsForgeClient,
  projectId: string
): Promise<Array<{ date: string; count: number }>>

listProjectSourceDomains(
  client: InsForgeClient,
  projectId: string
): Promise<SourceDomain[]>
```

`listChats` query shape:

```
prompt_runs
  ?project_id=eq.<id>
  &select=*,
    project_topics(id,name),
    tracked_prompts(id,prompt_text),
    prompt_run_responses(
      id, platform_code, status,
      response_brand_metrics(
        brand_entity_id,
        brand_entities(id, name, role)
      ),
      response_citations(id)
    )
```

Server-side filters applied when possible:

- `pipelineRunDate` → `scheduled_for=gte.<date>T00&scheduled_for=lt.<date+1>T00`
- `timeframe` → matching `scheduled_for` range
- `topicIds` → `project_topic_id=in.(...)`
- `trackedPromptIds` → `tracked_prompt_id=in.(...)`

`brandEntityIds` and `sourceDomainIds` are applied client-side in the mapping pass (PostgREST nested filters don't compose well here).

Sort: `scheduled_for DESC, created_at DESC`.

Pagination: the full filtered list is loaded (volumes are small at current scale); `@tanstack/react-table` handles slicing.

Topics, tracked prompts, brand entities, source domains, and AI platforms are reused from existing repositories / fetched alongside.

## Source grouping logic (`lib/chats/source-grouping.ts`)

Pure function:

```ts
export function groupSources(
  citations: Array<{ citation: ResponseCitation; page: SourcePage; domain: SourceDomain }>,
  brands: BrandEntity[]
): ChatSourceGroup
```

A citation is in `cited` iff its `domain.domain` (or a subdomain of it) matches any `brand.website_host` across the project's brands (primary or competitor). First match wins for `matchedBrand`. Case-insensitive, ignoring `www.` prefix.

Edge cases:

- Empty brand list → everything lands in `notCited`.
- Domain string lacks a host → lands in `notCited`, `matchedBrand=null`.
- Citation's cited_url resolves to a different host than the stored `source_domains.domain` — we trust `source_domains.domain`.

## Routes & file layout

```
app/dashboard/chats/
  page.tsx                              # renders <ChatsPage />
  loading.tsx                           # already exists
  [promptRunId]/
    page.tsx                            # renders <ChatDetailPage promptRunId={...} />
    loading.tsx                         # detail skeleton

components/dashboard/chats/
  chats-page.tsx                        # client; loads list data + wires filters
  chats-filter-bar.tsx
  chats-list.tsx                        # @tanstack/react-table wrapper
  chats-list-row.tsx
  chat-detail-page.tsx                  # client; loads detail data
  chat-detail-header.tsx                # back link, prompt, topic, scheduled
  chat-platform-toggle.tsx              # tabs switching which response is shown
  chat-response-body.tsx                # markdown + platform/model banner
  chat-brands-panel.tsx                 # right rail
  chat-sources-section.tsx              # cited / not-cited lists
  filters/
    pipeline-run-select.tsx
    timeframe-select.tsx
    topic-multi-select.tsx
    prompt-multi-select.tsx
    brand-multi-select.tsx
    source-multi-select.tsx
    search-input.tsx

lib/chats/
  types.ts
  filters.ts
  filters.test.ts
  repository.ts
  repository.test.ts
  source-grouping.ts
  source-grouping.test.ts
```

## UI details

### List page

- Filter bar sticks to the top of the card; filter chips with counts when active.
- "Clear all" button appears when `hasActiveFilters(filters)`.
- Row layout:

  ```
  Prompt text (2-line clamp)
  Topic badge · Scheduled Apr 21 · 3/3 platforms ✓
  Brands [logos + overflow count]   Sources: 8
  ```

- Row click → `/dashboard/chats/[promptRunId]?<current filter qs>`.
- Platform icons use `ai_platforms.label` and follow logo.dev conventions (already used elsewhere).
- Page size 25, pagination controls at bottom mirror the existing `prompts-table` pattern.
- Empty state: "No chats match these filters" + "Clear filters" CTA.

### Detail page

- Header: back link (preserves filter qs), topic badge, scheduled time, prompt text.
- Platform toggle: one tab per `prompt_run_responses` row. Failed/timeout platforms still render a tab but show an inline error instead of markdown.
- Response body:
  - Banner: platform label + `provider_model` + `responded_at` + `latency_ms`.
  - `react-markdown` with `remark-gfm`; default sanitization (no `rehype-raw`).
- Brands panel (right rail):
  - Primary brand at top with "Primary" badge, rank / sentiment / visibility / citation scores.
  - Competitors below, sorted by rank (nulls last), each showing the same metrics.
  - If no brand metrics for a platform, panel shows "No brand mentions detected."
- Sources section (bottom):
  - Two groups: "Cited project brands (N)" / "Did not cite (N)".
  - Each entry: domain favicon (via existing `buildBrandLogoUrl` fallback), page title (or URL if null), canonical URL, citation order.
  - Cited entries show a small brand badge indicating which project brand matched.

## Edge cases

| Case | Handling |
|------|----------|
| `prompt_run` still queued/running with 0 responses | Detail shows "No responses yet" for each platform tab; list row shows `0/N platforms` + spinner. |
| Response status = failed/timeout/blocked/rate_limited | Tab renders status + `error_message`; brands panel and sources hide for that platform. |
| Response complete but no brand metrics | Brands panel: "No brand mentions detected." |
| Response complete but no citations | Sources: "No citations recorded." |
| Citation host matches no brand | Lands in `notCited`, `matchedBrand=null`. |
| Citation host matches multiple brands | First match (primary preferred) populates `matchedBrand`. |
| Project has no primary brand set | Brands panel renders competitors only; source grouping works fine. |
| URL filter references a deleted entity | Silently dropped, URL re-serialized. |
| Response markdown contains raw HTML | Dropped by `react-markdown`'s default sanitization. |
| Filter produces zero rows | Empty state with "Clear filters" CTA. |

## Error handling

- Repository functions throw on Insforge errors; page components catch and render an error card with a "Try again" button (mirrors `PromptsPage`).
- Per-platform response failures render inline in the detail view — a chat isn't broken just because one provider failed.
- Background filter option loaders (brands/source domains) show skeletons and degrade gracefully if they fail.

## Testing

- `lib/chats/filters.test.ts` — `applyFilters` covers each filter axis individually and in combination; `filtersToQueryString` / `filtersFromQueryString` round-trip; invalid IDs dropped; pipeline run overrides timeframe.
- `lib/chats/repository.test.ts` — PostgREST fixtures mapped to `ChatSummary[]` and `ChatDetail`; missing optional fields handled; platform ordering follows `ai_platforms.sort_order`.
- `lib/chats/source-grouping.test.ts` — host-match edge cases: subdomain match, `www.` prefix, case insensitivity, missing primary, multi-brand match precedence, empty brand list.

## Dependencies

- npm: add `react-markdown`, `remark-gfm`.
- shadcn primitives to install (`npx shadcn add`): `tabs` (platform toggle), `popover` (multi-select filters), `command` (searchable filter lists).
- No schema changes.
- No new environment variables.

## Rollout

- No feature flag. The page replaces the placeholder directly and is only visible behind the existing auth gate.
- A follow-up can add Trigger.dev realtime subscription on the detail view for in-progress runs.
