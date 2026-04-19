# Prompts Route Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder `/dashboard/prompts` page with a real screen that lists tracked topics and their prompts in a collapsible shadcn table, with a platform filter (ChatGPT/Claude/Perplexity logos via logo.dev), countdown timer, Edit, and "+ Add Prompt" controls. Metrics columns are populated by deterministic mocks.

**Architecture:** Client-side data load using existing `loadProjectTopics` and `loadTrackedPromptsByProject` repository helpers. Compose UI from shadcn `<Table>` primitive plus `<Collapsible>` for topic groups. Deterministic per-prompt mock metrics keyed on `promptId + platform` so values are stable across renders and feel real when toggling tabs. Reuse the existing `buildBrandLogoUrl` for platform tabs and competitor avatars.

**Tech Stack:** Next.js 16 (Turbopack, App Router), React 19, Tailwind v4, radix-lyra shadcn registry, HugeIcons, vitest + @testing-library/react.

---

## File Structure

**Created**

- `components/ui/table.tsx` — shadcn Table primitive (installed via shadcn CLI)
- `lib/dashboard/prompts-mock.ts` — deterministic metric generator (pure)
- `lib/dashboard/prompt-platforms.ts` — list of platform configs (chatgpt/claude/perplexity)
- `components/dashboard/prompts/prompts-page.tsx` — client root, loads data
- `components/dashboard/prompts/prompts-header.tsx` — title + timer + Edit + Add buttons
- `components/dashboard/prompts/next-run-timer.tsx` — countdown display
- `components/dashboard/prompts/platform-filter.tsx` — segmented logo tabs
- `components/dashboard/prompts/prompts-table.tsx` — table shell with collapsible topic groups
- `components/dashboard/prompts/cells/visibility-cell.tsx`
- `components/dashboard/prompts/cells/top-performers-cell.tsx`
- `components/dashboard/prompts/cells/sentiment-cell.tsx`
- `components/dashboard/prompts/cells/status-cell.tsx`
- `tests/lib/prompts-mock.test.ts` — unit tests for the mock generator
- `tests/components/prompts-page.test.tsx` — smoke test for the page

**Modified**

- `app/dashboard/prompts/page.tsx` — render `<PromptsPage />` instead of the placeholder

**No change** (referenced only)

- `lib/project-topics/repository.ts` — `loadProjectTopics`
- `lib/tracked-prompts/repository.ts` — `loadTrackedPromptsByProject`
- `lib/brands/logo.ts` — `buildBrandLogoUrl`
- `lib/logo-dev/config.ts` — `resolveLogoDevPublicConfig`
- `components/auth-provider.tsx` — `useAuth`
- `components/ui/{button,card,collapsible,skeleton,badge}.tsx`

---

## Task 1: Install the shadcn Table primitive

**Files:**
- Create: `components/ui/table.tsx`

- [ ] **Step 1: Run the shadcn add command**

```bash
npx shadcn@latest add table --yes
```

Expected: command writes `components/ui/table.tsx` and reports success. If it asks any interactive question, accept defaults.

- [ ] **Step 2: Verify the file exists and exports `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `TableCaption`, `TableFooter`**

Run:
```bash
grep -E "export \{|^function (Table|TableHeader|TableBody|TableRow|TableHead|TableCell)" components/ui/table.tsx
```

Expected output: a single `export { ... }` block that includes at least `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`. (TableCaption/TableFooter may be present too — that's fine.)

- [ ] **Step 3: Typecheck to make sure the new file compiles**

Run:
```bash
npm run typecheck
```

Expected: `tsc --noEmit` exits 0.

- [ ] **Step 4: Commit**

```bash
git add components/ui/table.tsx components.json package.json package-lock.json 2>/dev/null
git commit -m "Add shadcn table primitive"
```

(If `components.json` or `package.json` weren't modified by the CLI, just commit `components/ui/table.tsx`.)

---

## Task 2: Deterministic mock generator (`lib/dashboard/prompts-mock.ts`)

**Files:**
- Create: `lib/dashboard/prompts-mock.ts`
- Test: `tests/lib/prompts-mock.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/prompts-mock.test.ts`:

```ts
import { describe, expect, it } from "vitest"

import {
  mockSentiment,
  mockStatusRanAt,
  mockTopPerformerCount,
  mockVisibility,
} from "@/lib/dashboard/prompts-mock"

describe("prompts mock generator", () => {
  it("returns the same visibility for the same prompt and platform", () => {
    const a = mockVisibility("prompt-1", "chatgpt")
    const b = mockVisibility("prompt-1", "chatgpt")

    expect(a).toBe(b)
  })

  it("varies visibility when the platform changes", () => {
    const chatgpt = mockVisibility("prompt-1", "chatgpt")
    const claude = mockVisibility("prompt-1", "claude")

    expect(chatgpt).not.toBe(claude)
  })

  it("clamps visibility to 0..100", () => {
    for (const id of ["a", "b", "c", "d", "e", "f"]) {
      const value = mockVisibility(id, "chatgpt")

      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(100)
    }
  })

  it("returns one of the three sentiment tones", () => {
    const tone = mockSentiment("prompt-1", "chatgpt")

    expect(["positive", "neutral", "negative"]).toContain(tone)
  })

  it("returns the same sentiment for the same input", () => {
    expect(mockSentiment("prompt-1", "claude")).toBe(
      mockSentiment("prompt-1", "claude")
    )
  })

  it("returns a Date in the past for status", () => {
    const ranAt = mockStatusRanAt("prompt-1")

    expect(ranAt.getTime()).toBeLessThanOrEqual(Date.now())
  })

  it("returns a positive integer top performer count", () => {
    const count = mockTopPerformerCount("prompt-1")

    expect(Number.isInteger(count)).toBe(true)
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
```

- [ ] **Step 2: Run the test, expect failure**

Run:
```bash
npm test -- tests/lib/prompts-mock.test.ts
```

Expected: vitest fails with "Cannot find module '@/lib/dashboard/prompts-mock'".

- [ ] **Step 3: Implement the generator**

Create `lib/dashboard/prompts-mock.ts`:

```ts
export type SentimentTone = "positive" | "neutral" | "negative"

const SENTIMENTS: SentimentTone[] = ["positive", "neutral", "negative"]

const HOUR_MS = 60 * 60 * 1000

function fnv1a(input: string): number {
  let hash = 0x811c9dc5

  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }

  return hash >>> 0
}

function unitSeed(promptId: string, platform: string): number {
  return fnv1a(`${promptId}:${platform}`) / 0xffffffff
}

export function mockVisibility(promptId: string, platform: string): number {
  const seed = unitSeed(promptId, platform)

  return Math.round(seed * 100)
}

export function mockSentiment(
  promptId: string,
  platform: string
): SentimentTone {
  const seed = unitSeed(`${promptId}:sentiment`, platform)
  const index = Math.floor(seed * SENTIMENTS.length)

  return SENTIMENTS[Math.min(index, SENTIMENTS.length - 1)]
}

export function mockStatusRanAt(promptId: string): Date {
  const seed = unitSeed(`${promptId}:status`, "global")
  const hoursAgo = Math.floor(seed * 240) + 1

  return new Date(Date.now() - hoursAgo * HOUR_MS)
}

export function mockTopPerformerCount(promptId: string): number {
  const seed = unitSeed(`${promptId}:performers`, "global")

  return Math.floor(seed * 6)
}
```

- [ ] **Step 4: Run tests, expect pass**

Run:
```bash
npm test -- tests/lib/prompts-mock.test.ts
```

Expected: all 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard/prompts-mock.ts tests/lib/prompts-mock.test.ts
git commit -m "Add deterministic prompts mock generator"
```

---

## Task 3: Platform config (`lib/dashboard/prompt-platforms.ts`)

**Files:**
- Create: `lib/dashboard/prompt-platforms.ts`

- [ ] **Step 1: Implement**

Create `lib/dashboard/prompt-platforms.ts`:

```ts
export type PromptPlatformId = "chatgpt" | "claude" | "perplexity"

export interface PromptPlatform {
  id: PromptPlatformId
  label: string
  domain: string
}

export const PROMPT_PLATFORMS: PromptPlatform[] = [
  { id: "chatgpt", label: "ChatGPT", domain: "chatgpt.com" },
  { id: "claude", label: "Claude", domain: "claude.ai" },
  { id: "perplexity", label: "Perplexity", domain: "perplexity.ai" },
]
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add lib/dashboard/prompt-platforms.ts
git commit -m "Add prompt platform config"
```

---

## Task 4: Countdown timer (`next-run-timer.tsx`)

**Files:**
- Create: `components/dashboard/prompts/next-run-timer.tsx`

- [ ] **Step 1: Implement**

Create `components/dashboard/prompts/next-run-timer.tsx`:

```tsx
"use client"

import * as React from "react"

function formatHHMMSS(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds))
  const hours = Math.floor(safe / 3600)
  const minutes = Math.floor((safe % 3600) / 60)
  const seconds = safe % 60
  const pad = (value: number) => value.toString().padStart(2, "0")

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function NextRunTimer({ target }: { target: Date }) {
  const [now, setNow] = React.useState(() => Date.now())

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now())
    }, 1000)

    return () => {
      window.clearInterval(interval)
    }
  }, [])

  const remaining = Math.max(0, (target.getTime() - now) / 1000)

  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      Next Prompt Run:{" "}
      <span className="font-medium text-foreground">
        {formatHHMMSS(remaining)}
      </span>
    </span>
  )
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/prompts/next-run-timer.tsx
git commit -m "Add NextRunTimer countdown component"
```

---

## Task 5: Header (`prompts-header.tsx`)

**Files:**
- Create: `components/dashboard/prompts/prompts-header.tsx`

- [ ] **Step 1: Implement**

Create `components/dashboard/prompts/prompts-header.tsx`:

```tsx
"use client"

import { Add01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { NextRunTimer } from "@/components/dashboard/prompts/next-run-timer"
import { Button } from "@/components/ui/button"

export function PromptsHeader({
  nextRunAt,
  onAddPrompt,
  onEditSchedule,
}: {
  nextRunAt: Date
  onAddPrompt: () => void
  onEditSchedule: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight">Prompts</h1>
      <div className="flex items-center gap-3">
        <NextRunTimer target={nextRunAt} />
        <Button type="button" variant="outline" size="sm" onClick={onEditSchedule}>
          Edit
        </Button>
        <Button type="button" size="sm" onClick={onAddPrompt}>
          <HugeiconsIcon icon={Add01Icon} strokeWidth={2} />
          Add Prompt
        </Button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/prompts/prompts-header.tsx
git commit -m "Add prompts page header"
```

---

## Task 6: Platform filter (`platform-filter.tsx`)

**Files:**
- Create: `components/dashboard/prompts/platform-filter.tsx`

- [ ] **Step 1: Implement**

Create `components/dashboard/prompts/platform-filter.tsx`:

```tsx
"use client"

import * as React from "react"

import { buildBrandLogoUrl } from "@/lib/brands/logo"
import {
  PROMPT_PLATFORMS,
  type PromptPlatformId,
} from "@/lib/dashboard/prompt-platforms"
import { resolveLogoDevPublicConfig } from "@/lib/logo-dev/config"
import { cn } from "@/lib/utils"

export function PlatformFilter({
  value,
  onChange,
}: {
  value: PromptPlatformId
  onChange: (platform: PromptPlatformId) => void
}) {
  const publishableKey = React.useMemo(() => {
    try {
      return resolveLogoDevPublicConfig().publishableKey
    } catch {
      return null
    }
  }, [])

  return (
    <div
      role="tablist"
      aria-label="Filter by platform"
      className="flex w-fit items-center gap-1 border-b border-border"
    >
      {PROMPT_PLATFORMS.map((platform) => {
        const isActive = platform.id === value
        const logoUrl = publishableKey
          ? buildBrandLogoUrl(platform.domain, publishableKey)
          : null

        return (
          <button
            key={platform.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(platform.id)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-3 py-2 text-sm transition-colors",
              isActive
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                width={16}
                height={16}
                className="size-4 object-contain"
              />
            ) : null}
            <span>{platform.label}</span>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/prompts/platform-filter.tsx
git commit -m "Add platform filter with logo.dev tabs"
```

---

## Task 7: Visibility cell (`cells/visibility-cell.tsx`)

**Files:**
- Create: `components/dashboard/prompts/cells/visibility-cell.tsx`

- [ ] **Step 1: Implement**

Create `components/dashboard/prompts/cells/visibility-cell.tsx`:

```tsx
import { cn } from "@/lib/utils"

function getColorClass(percent: number) {
  if (percent >= 60) {
    return "bg-emerald-500"
  }

  if (percent >= 30) {
    return "bg-amber-500"
  }

  return "bg-rose-500"
}

export function VisibilityCell({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent))

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-16 overflow-hidden bg-muted">
        <div
          className={cn("h-full", getColorClass(clamped))}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className="w-8 text-xs tabular-nums text-foreground">
        {clamped}%
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/prompts/cells/visibility-cell.tsx
git commit -m "Add VisibilityCell component"
```

---

## Task 8: Sentiment cell (`cells/sentiment-cell.tsx`)

**Files:**
- Create: `components/dashboard/prompts/cells/sentiment-cell.tsx`

- [ ] **Step 1: Implement**

Create `components/dashboard/prompts/cells/sentiment-cell.tsx`:

```tsx
import type { SentimentTone } from "@/lib/dashboard/prompts-mock"
import { cn } from "@/lib/utils"

const STYLES: Record<SentimentTone, string> = {
  positive: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  neutral: "bg-muted text-muted-foreground",
  negative: "bg-rose-50 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
}

const LABELS: Record<SentimentTone, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
}

export function SentimentCell({ tone }: { tone: SentimentTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center px-2 text-xs font-medium",
        STYLES[tone]
      )}
    >
      {LABELS[tone]}
    </span>
  )
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/prompts/cells/sentiment-cell.tsx
git commit -m "Add SentimentCell component"
```

---

## Task 9: Status cell (`cells/status-cell.tsx`)

**Files:**
- Create: `components/dashboard/prompts/cells/status-cell.tsx`

- [ ] **Step 1: Implement**

Create `components/dashboard/prompts/cells/status-cell.tsx`:

```tsx
function formatRelative(ranAt: Date): string {
  const diffMs = Date.now() - ranAt.getTime()
  const minutes = Math.max(0, Math.floor(diffMs / 60000))

  if (minutes < 1) {
    return "just now"
  }

  if (minutes < 60) {
    return `${minutes}m ago`
  }

  const hours = Math.floor(minutes / 60)

  if (hours < 24) {
    return `${hours}h ago`
  }

  const days = Math.floor(hours / 24)

  return `${days}d ago`
}

export function StatusCell({ ranAt }: { ranAt: Date | null }) {
  if (!ranAt) {
    return <span className="text-xs text-muted-foreground">Not run yet</span>
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden="true"
        className="size-1.5 rounded-full bg-emerald-500"
      />
      Prompt ran {formatRelative(ranAt)}
    </span>
  )
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/prompts/cells/status-cell.tsx
git commit -m "Add StatusCell component"
```

---

## Task 10: Top performers cell (`cells/top-performers-cell.tsx`)

**Files:**
- Create: `components/dashboard/prompts/cells/top-performers-cell.tsx`

- [ ] **Step 1: Implement**

Create `components/dashboard/prompts/cells/top-performers-cell.tsx`:

```tsx
import { resolveBrandWebsitePreview } from "@/lib/brands/logo"
import type { BrandCompetitor } from "@/lib/brands/types"
import { resolveLogoDevPublicConfig } from "@/lib/logo-dev/config"

const MAX_VISIBLE = 3

function getInitials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  )
}

export function TopPerformersCell({
  competitors,
  count,
}: {
  competitors: BrandCompetitor[]
  count: number
}) {
  if (competitors.length === 0) {
    return <span className="text-xs text-muted-foreground">--</span>
  }

  let publishableKey: string | null = null

  try {
    publishableKey = resolveLogoDevPublicConfig().publishableKey
  } catch {
    publishableKey = null
  }

  const visible = competitors.slice(0, MAX_VISIBLE)
  const overflow = Math.max(0, count - visible.length)

  return (
    <div className="flex items-center">
      <div className="flex -space-x-2">
        {visible.map((competitor) => {
          const preview = publishableKey
            ? resolveBrandWebsitePreview(competitor.website, publishableKey)
            : null

          return (
            <span
              key={competitor.id}
              title={competitor.name}
              className="flex size-6 items-center justify-center overflow-hidden border border-background bg-muted text-[10px] font-medium uppercase text-muted-foreground"
            >
              {preview ? (
                <img
                  src={preview.logoUrl}
                  alt={competitor.name}
                  width={24}
                  height={24}
                  className="size-full object-contain"
                />
              ) : (
                getInitials(competitor.name)
              )}
            </span>
          )
        })}
      </div>
      {overflow > 0 ? (
        <span className="ml-2 text-xs text-muted-foreground">+{overflow}</span>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/prompts/cells/top-performers-cell.tsx
git commit -m "Add TopPerformersCell component"
```

---

## Task 11: Prompts table (`prompts-table.tsx`)

**Files:**
- Create: `components/dashboard/prompts/prompts-table.tsx`

- [ ] **Step 1: Implement**

Create `components/dashboard/prompts/prompts-table.tsx`:

```tsx
"use client"

import * as React from "react"
import { ArrowDown01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"

import { SentimentCell } from "@/components/dashboard/prompts/cells/sentiment-cell"
import { StatusCell } from "@/components/dashboard/prompts/cells/status-cell"
import { TopPerformersCell } from "@/components/dashboard/prompts/cells/top-performers-cell"
import { VisibilityCell } from "@/components/dashboard/prompts/cells/visibility-cell"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BrandCompetitor } from "@/lib/brands/types"
import {
  mockSentiment,
  mockStatusRanAt,
  mockTopPerformerCount,
  mockVisibility,
  type SentimentTone,
} from "@/lib/dashboard/prompts-mock"
import type { ProjectTopic } from "@/lib/project-topics/types"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"
import { cn } from "@/lib/utils"

const SENTIMENT_RANK: Record<SentimentTone, number> = {
  positive: 2,
  neutral: 1,
  negative: 0,
}

const RANK_TO_SENTIMENT: SentimentTone[] = ["negative", "neutral", "positive"]

function formatCreated(value: string) {
  const created = new Date(value)
  const diffDays = Math.floor((Date.now() - created.getTime()) / 86_400_000)

  if (diffDays < 1) {
    return "today"
  }

  if (diffDays === 1) {
    return "1 day ago"
  }

  if (diffDays < 30) {
    return `${diffDays} days ago`
  }

  return created.toLocaleDateString()
}

function aggregateSentiment(
  prompts: TrackedPrompt[],
  platform: string
): SentimentTone {
  if (prompts.length === 0) {
    return "neutral"
  }

  const total = prompts.reduce(
    (sum, prompt) => sum + SENTIMENT_RANK[mockSentiment(prompt.id, platform)],
    0
  )
  const avg = Math.round(total / prompts.length)

  return RANK_TO_SENTIMENT[Math.min(2, Math.max(0, avg))]
}

function aggregateVisibility(prompts: TrackedPrompt[], platform: string) {
  if (prompts.length === 0) {
    return 0
  }

  const total = prompts.reduce(
    (sum, prompt) => sum + mockVisibility(prompt.id, platform),
    0
  )

  return Math.round(total / prompts.length)
}

function latestRanAt(prompts: TrackedPrompt[]): Date | null {
  if (prompts.length === 0) {
    return null
  }

  return prompts
    .map((prompt) => mockStatusRanAt(prompt.id))
    .reduce((latest, current) => (current > latest ? current : latest))
}

export function PromptsTable({
  topics,
  promptsByTopic,
  competitors,
  platform,
}: {
  topics: ProjectTopic[]
  promptsByTopic: Map<string, TrackedPrompt[]>
  competitors: BrandCompetitor[]
  platform: string
}) {
  const [openTopics, setOpenTopics] = React.useState<Record<string, boolean>>(
    () => Object.fromEntries(topics.map((topic) => [topic.id, true]))
  )

  function toggleTopic(topicId: string) {
    setOpenTopics((current) => ({
      ...current,
      [topicId]: !current[topicId],
    }))
  }

  return (
    <div className="overflow-hidden border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="min-w-[280px]">Topic</TableHead>
            <TableHead>Avg. Visibility</TableHead>
            <TableHead>Top Performers</TableHead>
            <TableHead>Sentiment</TableHead>
            <TableHead>Created</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {topics.map((topic) => {
            const prompts = promptsByTopic.get(topic.id) ?? []
            const isOpen = openTopics[topic.id] !== false
            const visibility = aggregateVisibility(prompts, platform)
            const sentiment = aggregateSentiment(prompts, platform)
            const ranAt = latestRanAt(prompts)
            const performerCount = prompts.length
              ? Math.max(
                  ...prompts.map((prompt) => mockTopPerformerCount(prompt.id))
                )
              : 0

            return (
              <React.Fragment key={topic.id}>
                <TableRow
                  data-state={isOpen ? "open" : "closed"}
                  className="bg-muted/40"
                >
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => toggleTopic(topic.id)}
                      disabled={prompts.length === 0}
                      className="flex items-center gap-2 text-left text-sm font-medium disabled:opacity-50"
                    >
                      <HugeiconsIcon
                        icon={isOpen ? ArrowDown01Icon : ArrowRight01Icon}
                        strokeWidth={2}
                        className="size-3.5 text-muted-foreground"
                      />
                      <span>{topic.name}</span>
                      <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center bg-background px-1.5 text-[11px] tabular-nums text-muted-foreground">
                        {prompts.length}
                      </span>
                    </button>
                  </TableCell>
                  <TableCell>
                    <VisibilityCell percent={visibility} />
                  </TableCell>
                  <TableCell>
                    <TopPerformersCell
                      competitors={competitors}
                      count={performerCount}
                    />
                  </TableCell>
                  <TableCell>
                    <SentimentCell tone={sentiment} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatCreated(topic.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <StatusCell ranAt={ranAt} />
                  </TableCell>
                </TableRow>
                {isOpen
                  ? prompts.map((prompt) => (
                      <TableRow key={prompt.id}>
                        <TableCell>
                          <div className={cn("pl-7 text-sm")}>
                            {prompt.prompt_text}
                          </div>
                        </TableCell>
                        <TableCell>
                          <VisibilityCell
                            percent={mockVisibility(prompt.id, platform)}
                          />
                        </TableCell>
                        <TableCell>
                          <TopPerformersCell
                            competitors={competitors}
                            count={mockTopPerformerCount(prompt.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <SentimentCell
                            tone={mockSentiment(prompt.id, platform)}
                          />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatCreated(prompt.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <StatusCell ranAt={mockStatusRanAt(prompt.id)} />
                        </TableCell>
                      </TableRow>
                    ))
                  : null}
              </React.Fragment>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/prompts/prompts-table.tsx
git commit -m "Add collapsible prompts table"
```

---

## Task 12: Page shell (`prompts-page.tsx`)

**Files:**
- Create: `components/dashboard/prompts/prompts-page.tsx`

- [ ] **Step 1: Implement**

Create `components/dashboard/prompts/prompts-page.tsx`:

```tsx
"use client"

import * as React from "react"

import { useAuth } from "@/components/auth-provider"
import { PlatformFilter } from "@/components/dashboard/prompts/platform-filter"
import { PromptsHeader } from "@/components/dashboard/prompts/prompts-header"
import { PromptsTable } from "@/components/dashboard/prompts/prompts-table"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { PromptPlatformId } from "@/lib/dashboard/prompt-platforms"
import { getInsforgeBrowserClient } from "@/lib/insforge/browser-client"
import { loadProjectTopics } from "@/lib/project-topics/repository"
import type { ProjectTopic } from "@/lib/project-topics/types"
import { loadTrackedPromptsByProject } from "@/lib/tracked-prompts/repository"
import type { TrackedPrompt } from "@/lib/tracked-prompts/types"

const NEXT_RUN_OFFSET_MS = 4 * 60 * 60 * 1000

export function PromptsPage() {
  const { brand } = useAuth()
  const projectId = brand?.id ?? null
  const [topics, setTopics] = React.useState<ProjectTopic[]>([])
  const [prompts, setPrompts] = React.useState<TrackedPrompt[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [platform, setPlatform] = React.useState<PromptPlatformId>("chatgpt")
  const nextRunAt = React.useMemo(
    () => new Date(Date.now() + NEXT_RUN_OFFSET_MS),
    []
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
        const [loadedTopics, loadedPrompts] = await Promise.all([
          loadProjectTopics(client, currentProjectId),
          loadTrackedPromptsByProject(client, currentProjectId),
        ])

        if (cancelled) {
          return
        }

        setTopics(
          loadedTopics
            .filter((topic) => topic.is_active)
            .sort((a, b) => a.sort_order - b.sort_order)
        )
        setPrompts(loadedPrompts.filter((prompt) => prompt.is_active))
      } catch (caught) {
        if (cancelled) {
          return
        }

        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load prompts."
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
  }, [projectId])

  const promptsByTopic = React.useMemo(() => {
    const map = new Map<string, TrackedPrompt[]>()

    for (const prompt of prompts) {
      const list = map.get(prompt.project_topic_id) ?? []

      list.push(prompt)
      map.set(prompt.project_topic_id, list)
    }

    for (const list of map.values()) {
      list.sort((a, b) => a.created_at.localeCompare(b.created_at))
    }

    return map
  }, [prompts])

  const competitors = brand?.competitors ?? []
  const hasData = topics.length > 0

  return (
    <div className="flex flex-1 flex-col gap-4 p-6 pt-2">
      <PromptsHeader
        nextRunAt={nextRunAt}
        onAddPrompt={() => {}}
        onEditSchedule={() => {}}
      />
      <PlatformFilter value={platform} onChange={setPlatform} />
      {error ? (
        <Card className="p-6 text-sm text-destructive">{error}</Card>
      ) : isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : hasData ? (
        <PromptsTable
          topics={topics}
          promptsByTopic={promptsByTopic}
          competitors={competitors}
          platform={platform}
        />
      ) : (
        <Card className="p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No prompts tracked yet.
          </p>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/prompts/prompts-page.tsx
git commit -m "Add PromptsPage data orchestration"
```

---

## Task 13: Wire the route

**Files:**
- Modify: `app/dashboard/prompts/page.tsx`

- [ ] **Step 1: Replace the placeholder**

Overwrite `app/dashboard/prompts/page.tsx` with:

```tsx
import { PromptsPage } from "@/components/dashboard/prompts/prompts-page"

export default function Page() {
  return <PromptsPage />
}
```

- [ ] **Step 2: Typecheck**

Run:
```bash
npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Lint**

Run:
```bash
npm run lint
```

Expected: exit 0 (no errors). Warnings about `<img>` vs `next/image` are acceptable since the code base already uses raw `<img>`/`AvatarImage` for logo.dev URLs.

- [ ] **Step 4: Commit**

```bash
git add app/dashboard/prompts/page.tsx
git commit -m "Wire Prompts route to new PromptsPage"
```

---

## Task 14: Smoke test for the page

**Files:**
- Create: `tests/components/prompts-page.test.tsx`

- [ ] **Step 1: Write the test**

Create `tests/components/prompts-page.test.tsx`:

```tsx
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/components/auth-provider", () => ({
  useAuth: () => ({
    brand: {
      id: "project-1",
      company_name: "Acme",
      competitors: [],
      created_at: "2026-01-01T00:00:00.000Z",
      description: "",
      onboarding_completed_at: "2026-01-02T00:00:00.000Z",
      topics: [],
      updated_at: "2026-01-01T00:00:00.000Z",
      user_id: "user-1",
      website: "https://acme.test",
    },
  }),
}))

vi.mock("@/lib/insforge/browser-client", () => ({
  getInsforgeBrowserClient: () => ({}),
}))

vi.mock("@/lib/logo-dev/config", () => ({
  resolveLogoDevPublicConfig: () => ({ publishableKey: "pk_test" }),
}))

vi.mock("@/lib/project-topics/repository", () => ({
  loadProjectTopics: vi.fn(),
}))

vi.mock("@/lib/tracked-prompts/repository", () => ({
  loadTrackedPromptsByProject: vi.fn(),
}))

import { PromptsPage } from "@/components/dashboard/prompts/prompts-page"
import { loadProjectTopics } from "@/lib/project-topics/repository"
import { loadTrackedPromptsByProject } from "@/lib/tracked-prompts/repository"

const loadProjectTopicsMock = loadProjectTopics as unknown as ReturnType<
  typeof vi.fn
>
const loadTrackedPromptsByProjectMock =
  loadTrackedPromptsByProject as unknown as ReturnType<typeof vi.fn>

beforeEach(() => {
  loadProjectTopicsMock.mockReset()
  loadTrackedPromptsByProjectMock.mockReset()
})

describe("PromptsPage", () => {
  it("renders topics and their prompts", async () => {
    loadProjectTopicsMock.mockResolvedValue([
      {
        id: "topic-1",
        project_id: "project-1",
        topic_catalog_id: null,
        name: "Business Credit Cards",
        normalized_name: "business credit cards",
        default_cadence: "weekly",
        source: "user_added",
        sort_order: 0,
        is_active: true,
        created_at: "2026-04-01T00:00:00.000Z",
        updated_at: "2026-04-01T00:00:00.000Z",
      },
    ])

    loadTrackedPromptsByProjectMock.mockResolvedValue([
      {
        id: "prompt-1",
        project_id: "project-1",
        project_topic_id: "topic-1",
        prompt_catalog_id: null,
        prompt_text: "Best business credit cards for startups",
        normalized_prompt: "best business credit cards for startups",
        cadence_override: null,
        added_via: "user_created",
        variant_type: null,
        pqs_score: null,
        pqs_rank: null,
        score_status: "unscored",
        score_metadata: {},
        source_analysis_run_id: null,
        is_active: true,
        next_run_at: null,
        last_run_at: null,
        created_at: "2026-04-05T00:00:00.000Z",
        updated_at: "2026-04-05T00:00:00.000Z",
      },
    ])

    render(<PromptsPage />)

    expect(
      await screen.findByText("Business Credit Cards")
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(
        screen.getByText("Best business credit cards for startups")
      ).toBeInTheDocument()
    })

    expect(screen.getByRole("heading", { name: "Prompts" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /add prompt/i })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /chatgpt/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /claude/i })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: /perplexity/i })).toBeInTheDocument()
  })

  it("shows the empty state when there are no topics", async () => {
    loadProjectTopicsMock.mockResolvedValue([])
    loadTrackedPromptsByProjectMock.mockResolvedValue([])

    render(<PromptsPage />)

    expect(
      await screen.findByText("No prompts tracked yet.")
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the test**

Run:
```bash
npm test -- tests/components/prompts-page.test.tsx
```

Expected: both tests pass.

- [ ] **Step 3: Commit**

```bash
git add tests/components/prompts-page.test.tsx
git commit -m "Add PromptsPage smoke test"
```

---

## Task 15: Final verification

- [ ] **Step 1: Run the full test suite**

Run:
```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Typecheck and lint together**

Run:
```bash
npm run typecheck && npm run lint
```

Expected: both exit 0.

- [ ] **Step 3: Manual smoke (best-effort)**

Start the dev server and load `/dashboard/prompts` in a browser:

```bash
npm run dev
```

Click each platform tab, expand/collapse a topic, verify the timer counts down, verify Edit/Add Prompt buttons render. If you can't open a browser in this environment, document this skip in the final summary.

Stop the dev server with `Ctrl+C` when done.

- [ ] **Step 4: No-op commit guard**

Run:
```bash
git status
```

Expected: clean working tree (everything committed in earlier tasks).
