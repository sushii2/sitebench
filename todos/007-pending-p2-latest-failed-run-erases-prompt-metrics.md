---
status: pending
priority: p2
issue_id: "007"
tags: [analytics, prompts, regressions]
dependencies: []
---

# Latest failed run erases prompt metrics

## Problem Statement

The prompt metrics repository now chooses the newest run for each prompt before checking whether that platform response actually produced usable metrics. A fresh failed/blocked/timeout run can therefore wipe out the last successful metrics shown in the prompts dashboard.

## Findings

- `lib/prompt-metrics/repository.ts:96-120` iterates newest-first and immediately locks in the first run that has a response for the selected platform.
- The selected response is not filtered by `status === "completed"`.
- When the newest response has no primary-brand metrics, the code writes `visibility: null`, `sentiment: null`, and `performerCount: 0` for that prompt.
- `components/dashboard/prompts/prompts-page.tsx:58-61` consumes `loadPromptMetrics()` directly for the prompts dashboard, so this behavior is user-visible.
- Existing tests cover only successful runs (`tests/lib/prompt-metrics-repository.test.ts`) and miss the failed-latest-run case.

## Proposed Solutions

### Option 1: Prefer the latest completed response with a primary metric

**Approach:** Filter candidate responses by matching platform and `status === "completed"`, then fall back to the newest response only if the product explicitly wants failure-state metrics.

**Pros:**
- Preserves the last good analytics snapshot
- Matches how users usually interpret “latest metrics”

**Cons:**
- Requires explicit UI treatment if product wants to show recent failures separately

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Return both latest response state and latest successful metrics

**Approach:** Model these separately so the UI can show “latest run failed” while still displaying the last successful analytics values.

**Pros:**
- Most accurate representation of current state
- Avoids overloading a single metric object with two meanings

**Cons:**
- Requires UI and type changes

**Effort:** 2-4 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.** At minimum, the repository should stop letting failed latest runs replace the last successful metric snapshot.

## Technical Details

**Affected files:**
- `lib/prompt-metrics/repository.ts`
- `components/dashboard/prompts/prompts-page.tsx`
- `tests/lib/prompt-metrics-repository.test.ts`

## Resources

- Review performed against current branch workspace on 2026-04-22

## Acceptance Criteria

- [ ] A failed/blocked/timed-out latest run does not null out the last successful prompt metrics
- [ ] Repository behavior is covered by tests for failed latest runs
- [ ] UI semantics are explicit about whether metrics represent latest run or latest successful run

## Work Log

### 2026-04-22 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed `lib/prompt-metrics/repository.ts:90-123`
- Traced metric loading into `components/dashboard/prompts/prompts-page.tsx:58-61`
- Checked current tests and confirmed the missing failed-run scenario

**Learnings:**
- The current reducer is deterministic, but it deterministically prefers recency over correctness
