---
status: pending
priority: p1
issue_id: "006"
tags: [reliability, prompt-runs, storage]
dependencies: []
---

# Blob upload failure blocks prompt-run persistence

## Problem Statement

Uploading raw response JSON to Vercel Blob now happens before any database inserts for prompt runs or responses. That turns an optional artifact into a hard dependency for the entire persistence pipeline.

## Findings

- `src/trigger/prompt-runs/persist-results.ts:216-257` uploads all raw response JSON blobs with `Promise.all`.
- `src/trigger/prompt-runs/persist-results.ts:290-292` awaits blob uploads before inserting `prompt_runs` or `prompt_run_responses`.
- If Blob is unavailable, misconfigured, rate-limited, or returns a transient failure for any single upload, the whole task throws before core run data is stored.
- New rows intentionally set `raw_response_json` to `null` (`src/trigger/prompt-runs/persist-results.ts:340`), so there is no inline fallback once blob storage is in play.

## Proposed Solutions

### Option 1: Make blob persistence best-effort after DB writes

**Approach:** Persist runs/responses first, then upload raw JSON in a follow-up step. On blob failure, keep the run data and log/queue a repair job.

**Pros:**
- Core analytics pipeline survives blob outages
- Easier retry semantics for storage-only failures
- Prevents data loss for otherwise successful provider executions

**Cons:**
- Requires a second update step for `raw_response_json_url`
- Temporary window where the URL is absent

**Effort:** 2-4 hours

**Risk:** Medium

---

### Option 2: Keep inline JSON until blob upload succeeds

**Approach:** Continue writing `raw_response_json` inline when upload fails, and only clear it once blob migration is confirmed.

**Pros:**
- Minimal product disruption
- Preserves debug/backfill data even during storage incidents

**Cons:**
- More complicated write path
- Temporary duplication of raw payload storage

**Effort:** 2-3 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.** The raw JSON artifact should not be able to prevent successful prompt-run data from being recorded.

## Technical Details

**Affected files:**
- `src/trigger/prompt-runs/persist-results.ts`
- `lib/prompt-runs/raw-response-blob.ts`

## Resources

- Review performed against current branch workspace on 2026-04-22

## Acceptance Criteria

- [ ] A blob-storage failure does not prevent `prompt_runs` and `prompt_run_responses` from being persisted
- [ ] Raw response storage has retryable or compensating behavior
- [ ] There is a clear logging path for storage-only failures

## Work Log

### 2026-04-22 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed the new blob upload flow in `src/trigger/prompt-runs/persist-results.ts`
- Verified that blob upload is awaited before any prompt-run insert occurs
- Confirmed new rows no longer store inline `raw_response_json`

**Learnings:**
- The change converts a secondary storage concern into a single point of failure for the ingestion pipeline

