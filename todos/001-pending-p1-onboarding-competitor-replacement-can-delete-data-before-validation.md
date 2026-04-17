---
status: pending
priority: p1
issue_id: "001"
tags: [onboarding, data-integrity, repository]
dependencies: []
---

# Onboarding competitor replacement can delete data before validation

The onboarding completion flow deletes all existing competitors before it validates or reinserts the replacement list. A malformed competitor website or any later insert failure can therefore wipe the user's current competitor set and return an error, leaving the project in a partially updated state.

## Findings

- `replaceBrandCompetitors()` deletes all competitor rows for the project before it calls `normalizeCompetitors()` or attempts the insert. See [lib/brands/repository.ts](/Users/saksham/conductor/workspaces/sitebench/delhi/lib/brands/repository.ts:406).
- `normalizeCompetitors()` calls `normalizeWebsite()`, which throws on invalid public URLs. See [lib/brands/normalizers.ts](/Users/saksham/conductor/workspaces/sitebench/delhi/lib/brands/normalizers.ts:56) and [lib/brands/validation.ts](/Users/saksham/conductor/workspaces/sitebench/delhi/lib/brands/validation.ts:71).
- The API schema for completion only requires competitor website strings to be non-empty, so malformed values can reach this repository path from the server boundary. See [lib/onboarding/types.ts](/Users/saksham/conductor/workspaces/sitebench/delhi/lib/onboarding/types.ts:90).
- `completeOnboardingSetup()` calls `replaceBrandCompetitors()` in the middle of a multi-step write flow, so the data-loss risk happens during the primary onboarding action. See [lib/onboarding/finalize.ts](/Users/saksham/conductor/workspaces/sitebench/delhi/lib/onboarding/finalize.ts:15).

## Proposed Solutions

### Option 1: Validate first, then replace

**Approach:** Normalize and validate the competitor payload before issuing any delete. Only delete and reinsert after the replacement set is known to be valid.

**Pros:**
- Removes the immediate data-loss path.
- Smallest code change.

**Cons:**
- Still leaves the delete+insert sequence non-atomic if the insert fails after delete.

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Perform replacement in a transaction or RPC

**Approach:** Move the full replacement flow into a single database transaction or server-side RPC that validates, deletes, and inserts atomically.

**Pros:**
- Prevents partial writes as well as pre-validation data loss.
- Better fit for onboarding's all-or-nothing semantics.

**Cons:**
- Higher implementation cost.
- Requires DB-side work or infrastructure support.

**Effort:** 3-5 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

Affected files:
- [lib/brands/repository.ts](/Users/saksham/conductor/workspaces/sitebench/delhi/lib/brands/repository.ts:406)
- [lib/brands/normalizers.ts](/Users/saksham/conductor/workspaces/sitebench/delhi/lib/brands/normalizers.ts:56)
- [lib/brands/validation.ts](/Users/saksham/conductor/workspaces/sitebench/delhi/lib/brands/validation.ts:71)
- [lib/onboarding/finalize.ts](/Users/saksham/conductor/workspaces/sitebench/delhi/lib/onboarding/finalize.ts:15)
- [lib/onboarding/types.ts](/Users/saksham/conductor/workspaces/sitebench/delhi/lib/onboarding/types.ts:90)

## Resources

- Review source branch: `sushii2/onboarding-ui-polish`
- Verification: `npm test`, `npm run typecheck`, `npm run lint`

## Acceptance Criteria

- [ ] Invalid competitor payloads are rejected before any existing rows are deleted.
- [ ] Competitor replacement is atomic or otherwise guaranteed not to lose previously saved rows on failure.
- [ ] A regression test covers invalid competitor input during onboarding completion.

## Work Log

### 2026-04-17 - Review Discovery

**By:** Codex

**Actions:**
- Reviewed the onboarding completion write path.
- Traced server-side validation from the API schema into the repository layer.
- Confirmed the delete happens before normalization and insert.

**Learnings:**
- The current server schema is weaker than the UI validation, so malformed competitor data can reach the destructive path.

