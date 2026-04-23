---
status: pending
priority: p1
issue_id: "005"
tags: [security, data-integrity, prompt-runs, storage]
dependencies: []
---

# Public blob storage exposes and overwrites raw responses

## Problem Statement

Raw provider responses are now being moved out of Postgres into Vercel Blob, but the blob objects are created as public and with deterministic, overwriteable paths. That bypasses the project-level RLS model and allows later runs to mutate the content referenced by older database rows.

## Findings

- `lib/prompt-runs/raw-response-blob.ts:17-23` writes blobs to `prompt-runs/{projectId}/{scheduledFor}/{trackedPromptId}-{platformCode}.json` with `access: "public"`, `addRandomSuffix: false`, and `allowOverwrite: true`.
- `src/trigger/prompt-runs/persist-results.ts:341-344` stores that public URL in `prompt_run_responses.raw_response_json_url`.
- Because the pathname does not include a unique run/response identifier, two runs for the same project, scheduled time, prompt, and provider will point at the same object key.
- When a later run overwrites that key, older `prompt_run_responses` rows keep the old URL but now resolve to the new payload.
- Public blob access also bypasses the database RLS protections that currently scope prompt-run data to the owning user/project.

## Proposed Solutions

### Option 1: Private blob objects with immutable keys

**Approach:** Use private blob access, include a unique run or response identifier in the object key, and store only opaque/private URLs or blob metadata in the database.

**Pros:**
- Preserves project access boundaries
- Prevents historical rows from being silently rewritten
- Keeps raw payload retention compatible with future auditing/debugging

**Cons:**
- Requires an authenticated retrieval path for debugging/backfills
- Needs a migration/reader update for any code expecting public URLs

**Effort:** 2-4 hours

**Risk:** Medium

---

### Option 2: Keep raw JSON in Postgres and add retention controls

**Approach:** Continue storing raw JSON inline or in a dedicated protected table, then add pruning/retention instead of offloading to public blob storage.

**Pros:**
- Reuses existing RLS model
- Avoids object-store consistency/key-management issues
- Simplifies reads and backfills

**Cons:**
- Larger database rows
- May require a separate cleanup policy for storage growth

**Effort:** 1-3 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.** Prefer private, immutable storage. Public overwriteable blobs are not acceptable for project-scoped raw model responses.

## Technical Details

**Affected files:**
- `lib/prompt-runs/raw-response-blob.ts`
- `src/trigger/prompt-runs/persist-results.ts`
- `db/migrations/0008_prompt_run_responses_blob_url.sql`

**Database changes (if any):**
- Existing `raw_response_json_url` values may need migration if key format or access mode changes.

## Resources

- Review performed against current branch workspace on 2026-04-22

## Acceptance Criteria

- [ ] Raw response artifacts are not publicly readable without project authorization
- [ ] Blob/object keys are immutable per persisted run/response
- [ ] Historical `prompt_run_responses` rows cannot be silently rewritten by later runs
- [ ] Backfills/debug tooling still has an authenticated way to read stored raw payloads

## Work Log

### 2026-04-22 - Initial Discovery

**By:** Codex

**Actions:**
- Reviewed `lib/prompt-runs/raw-response-blob.ts:13-26`
- Traced storage URL persistence in `src/trigger/prompt-runs/persist-results.ts:327-345`
- Confirmed the key does not include a unique prompt-run/response identifier

**Learnings:**
- The change weakens both access control and historical data integrity at the same time

