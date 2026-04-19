# Prompts Route Design

**Date:** 2026-04-19
**Owner:** sushii2
**Status:** Approved (pending implementation)

## Goal

Replace the placeholder `/dashboard/prompts` page with a real screen that lets users see every tracked topic and its prompts for the current project. The page surfaces per-prompt metrics (visibility, top performers, sentiment, status) and offers a platform filter and an "Add Prompt" affordance. Most metrics are hardcoded for now because the underlying analytics aren't wired up yet.

## Scope

In scope:

- New page UI at `app/dashboard/prompts/page.tsx`
- Header bar with title, "next prompt run" countdown, edit button, "+ Add Prompt" primary button
- Platform tab filter (ChatGPT, Claude, Perplexity) using logo.dev for logos
- Collapsible topic table with prompt children — columns: Topic/Prompt, Avg. Visibility, Top Performers, Sentiment, Created, Status
- Loads real topics and prompts from the database
- Hardcoded (deterministic) mocks for metric columns

Out of scope:

- Real metrics computation
- Add/Edit prompt dialogs (buttons render but do nothing)
- Editing the prompt run schedule (same — Edit button is non-functional)
- Per-platform data variation beyond cosmetic differences

## Data sources

- `loadProjectTopics(client, projectId)` — already exists in `lib/project-topics/repository.ts`
- `loadTrackedPromptsByProject(client, projectId)` — already exists in `lib/tracked-prompts/repository.ts`
- `useAuth().brand.id` for the project ID (this is the `tracking_projects.id`)
- `getInsforgeBrowserClient()` for the SDK client
- `buildBrandLogoUrl(domain, publishableKey)` from `lib/brands/logo.ts` for both platform logos and competitor logos
- `resolveLogoDevPublicConfig()` for the publishable key
- Brand competitors (`useAuth().brand.competitors`) for "Top Performers"

Filter behaviour: `is_active === true` for both topics and prompts; sort topics by `sort_order`, prompts by `created_at` ascending under each topic.

## File layout

```
app/dashboard/prompts/
  page.tsx               # server boundary; renders <PromptsPage />
  loading.tsx            # already exists; tweaked title preserved

components/dashboard/prompts/
  prompts-page.tsx       # client; data loading + state
  prompts-header.tsx     # title + countdown + Edit + Add Prompt
  platform-filter.tsx    # ChatGPT / Claude / Perplexity tabs with logo.dev logos
  prompts-table.tsx      # collapsible topic table
  prompt-row.tsx         # individual prompt row (cell composition)
  topic-row.tsx          # parent (topic) row — chevron + aggregate cells
  cells/
    visibility-cell.tsx  # progress bar + percent
    top-performers-cell.tsx
    sentiment-cell.tsx   # colored badge
    status-cell.tsx      # dot + relative time
  next-run-timer.tsx     # countdown component

components/ui/
  table.tsx              # add via shadcn (currently missing)

lib/dashboard/
  prompts-mock.ts        # deterministic per-prompt metric generator
```

## Component contracts

### `<PromptsPage />`
- Calls the repository functions in a `useEffect` after auth resolves.
- Local state: `topics`, `prompts`, `selectedPlatform` (default `"chatgpt"`), `isLoading`, `error`.
- Renders `<PromptsHeader />`, `<PlatformFilter />`, `<PromptsTable />`.
- Shows a small empty state if there are no topics or prompts.

### `<PromptsHeader />`
- Props: `nextRunAt: Date`, `onAddPrompt`, `onEditSchedule`.
- Layout: flex row, `<h1>Prompts</h1>` on the left, controls on the right.
- Right side, in order: `<NextRunTimer />`, `<Button variant="outline" size="sm">Edit</Button>`, `<Button size="sm">+ Add Prompt</Button>` (default variant which is the existing primary/black).

### `<NextRunTimer />`
- Props: `target: Date`.
- Updates every second using `setInterval`. Cleans up on unmount.
- Displays `Next Prompt Run: HH:MM:SS`. Uses tabular numerals.
- For now `target` is computed in `<PromptsPage />` as "now + 4h" on first mount. Stable across renders.

### `<PlatformFilter />`
- Props: `platforms: PlatformConfig[]`, `value`, `onChange`.
- Renders three pill tabs. Each tab shows a `<Image>` (or `<img>`) for the platform logo from logo.dev plus the platform name.
- Configured platforms (hardcoded):
  - `chatgpt` — `chatgpt.com`
  - `claude` — `claude.ai`
  - `perplexity` — `perplexity.ai`

### `<PromptsTable />`
- Props: `topics: ProjectTopic[]`, `promptsByTopic: Map<string, TrackedPrompt[]>`, `competitors: BrandCompetitor[]`, `platform: string`.
- Built on shadcn `<Table>` primitives plus `<Collapsible>` per topic group.
- Header columns: Topic | Avg. Visibility | Top Performers | Sentiment | Created | Status.
- Each topic row: chevron, topic name, prompt count chip; aggregated metric cells (average of children).
- Each prompt row, indented under its topic, shows the same column shape with per-prompt mock data.
- Hidden topics (no prompts) are still shown but the expand chevron is disabled.

### Cell components
- `<VisibilityCell percent: number />` — small horizontal progress bar with the percent label, color ramps (red → amber → green) based on bands.
- `<TopPerformersCell competitors: BrandCompetitor[] count: number />` — shows up to 3 overlapping circular logo avatars (logo.dev) plus a `+N` chip.
- `<SentimentCell tone: "positive" | "neutral" | "negative" />` — colored badge.
- `<StatusCell ranAt: Date | null />` — small green dot + "Prompt ran 3h ago" using relative time.

## Mock metric generation (`lib/dashboard/prompts-mock.ts`)

Pure functions that take a stable seed (the prompt's `id`) and the current `platform` and return deterministic numbers/categories. This guarantees the same row shows the same data on every render and the data shifts believably when the platform changes.

Exports:

```ts
mockVisibility(promptId: string, platform: string): number       // 0..100
mockSentiment(promptId: string, platform: string): "positive" | "neutral" | "negative"
mockStatusRanAt(promptId: string): Date                           // last "ran" timestamp
mockCompetitorCount(promptId: string): number                    // for the "+N" chip
```

A topic-level aggregate helper averages its children for the topic row.

Implementation: a tiny string-hash function (FNV-1a) keyed on `${promptId}:${platform}` to produce a stable 0..1 value, then mapped to the desired range.

## States

- **Loading:** existing `loading.tsx` shell stays — it already shows skeleton rows.
- **Error:** small Card ("We couldn't load your prompts" + retry button calling `refreshAuthState` + reload).
- **Empty (no topics or prompts):** Card with "No prompts tracked yet" copy and an "Add Prompt" button (still inert).

## Styling notes

- Match existing Dashboard look: `Card` wrapper with the same padding rhythm as `<DashboardHome />`.
- The "+ Add Prompt" button is the default `<Button>` variant (currently black/dark in the existing design system).
- Use `tabular-nums` for the timer.
- No emoji anywhere. Use HugeIcons for chevrons and the green status dot.

## Risks / things to validate

- shadcn `table.tsx` must be installed via the `shadcn` CLI/MCP (`get_add_command_for_items` / npx shadcn add table). Verify the primitive style matches the existing `radix-lyra` tokens.
- logo.dev tokens need to be present (the env var is already required by `resolveLogoDevPublicConfig` and used elsewhere — no new env config needed).
- `useAuth().brand` may be null briefly; loading guard handles it.
- The Image element for logos: use a regular `<img>` (or `next/image` with `unoptimized`) since logo.dev URLs are external and the codebase already uses raw `<AvatarImage>` for them.

## Open questions resolved

1. Edit / Add Prompt buttons render but no-op — confirmed.
2. Timer counts down to "now + 4h" — confirmed.
3. Empty state shows a friendly card — confirmed.
