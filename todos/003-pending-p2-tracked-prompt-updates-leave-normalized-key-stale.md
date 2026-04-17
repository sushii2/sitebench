---
status: pending
priority: p2
issue_id: "003"
tags: [prompts, data-integrity, repository]
dependencies: []
---

# Tracked prompt updates leave normalized key stale

When an existing tracked prompt is updated, the repository rewrites `prompt_text` but leaves `normalized_prompt` unchanged. Any later sync relies on `normalized_prompt` for matching and deactivation, so edited prompts can become impossible to match correctly and may produce duplicate active rows.

## Findings

- Existing prompts are matched by `candidate.normalized_prompt === normalizePromptText(prompt.promptText)`. See [lib/tracked-prompts/repository.ts](/Users/saksham/conductor/workspaces/sitebench/delhi/lib/tracked-prompts/repository.ts:82).
- The update path only writes `added_via`, `is_active`, and `prompt_text`; it never updates `normalized_prompt`. See [lib/tracked-prompts/repository.ts](/Users/saksham/conductor/workspaces/sitebench/delhi/lib/tracked-prompts/repository.ts:88).
- The table schema treats `(project_topic_id, normalized_prompt)` as the uniqueness key, so stale normalized values directly affect dedupe semantics. See [db/migrations/0001_brand_intelligence.sql](/Users/saksham/conductor/workspaces/sitebench/delhi/db/migrations/0001_brand_intelligence.sql:105).

## Proposed Solutions

### Option 1: Update the normalized key alongside prompt text

**Approach:** Whenever the update path changes `prompt_text`, also write `normalized_prompt: normalizePromptText(prompt.promptText)`.

**Pros:**
- Smallest fix.
- Aligns persisted data with the matching logic.

**Cons:**
- Existing bad rows may still need cleanup or a one-off migration.

**Effort:** <1 hour

**Risk:** Low

---

### Option 2: Match by row identity before content

**Approach:** Carry prompt IDs from the client and update by ID for existing prompts, using normalized text only for inserts and dedupe checks.

**Pros:**
- More robust for editing flows.
- Avoids fuzzy matching by mutable text.

**Cons:**
- Requires API and UI payload changes.

**Effort:** 3-5 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

Affected files:
- [lib/tracked-prompts/repository.ts](/Users/saksham/conductor/workspaces/sitebench/delhi/lib/tracked-prompts/repository.ts:61)
- [db/migrations/0001_brand_intelligence.sql](/Users/saksham/conductor/workspaces/sitebench/delhi/db/migrations/0001_brand_intelligence.sql:105)

## Resources

- Review source branch: `sushii2/onboarding-ui-polish`
- Verification: `npm test`, `npm run typecheck`, `npm run lint`

## Acceptance Criteria

- [ ] Updating a tracked prompt also updates its normalized key.
- [ ] Sync logic can round-trip an edited prompt without duplicating or deactivating the wrong row.
- [ ] A repository test covers editing an existing prompt's text.

## Work Log

### 2026-04-17 - Review Discovery

**By:** Codex

**Actions:**
- Reviewed the tracked-prompt sync logic used by onboarding completion.
- Compared the update path with the table uniqueness key.
- Identified mismatch between mutable prompt text and immutable normalized key.

**Learnings:**
- The repository currently assumes prompt text will not change after first persistence.

