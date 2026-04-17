---
status: pending
priority: p1
issue_id: "002"
tags: [onboarding, validation, backend]
dependencies: []
---

# Onboarding completion allows empty or duplicate prompt sets

The server accepts onboarding completion requests whose topics have zero prompts or duplicate prompts, even though the UI requires at least two unique prompts per topic. That means a crafted request or client bug can mark onboarding complete without creating a usable tracked-prompt set for downstream monitoring.

## Findings

- The client-side wizard enforces at least two unique prompts per topic before allowing completion. See [components/onboarding/onboarding-wizard.tsx](/Users/saksham/conductor/workspaces/sitebench/delhi/components/onboarding/onboarding-wizard.tsx:656).
- The server-side `onboardingTopicDraftSchema` only declares `prompts` as `z.array(...)` with no minimum length or uniqueness rules. See [lib/onboarding/types.ts](/Users/saksham/conductor/workspaces/sitebench/delhi/lib/onboarding/types.ts:72).
- `completeOnboardingSetup()` passes topic prompts straight into `syncTrackedPromptsForTopics()` and then marks onboarding complete. See [lib/onboarding/finalize.ts](/Users/saksham/conductor/workspaces/sitebench/delhi/lib/onboarding/finalize.ts:51).
- `syncTrackedPromptsForTopics()` silently dedupes and accepts empty prompt lists, so the completion call can succeed while persisting fewer than the product requires. See [lib/tracked-prompts/repository.ts](/Users/saksham/conductor/workspaces/sitebench/delhi/lib/tracked-prompts/repository.ts:24).

## Proposed Solutions

### Option 1: Mirror the UI rules in the Zod schema

**Approach:** Add server validation that requires each topic to contain at least two unique, non-empty prompts before the request reaches persistence.

**Pros:**
- Fixes the invariant at the API boundary.
- Keeps repository logic simple.

**Cons:**
- Needs careful error messages for nested validation failures.

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Enforce invariants in the finalization layer too

**Approach:** Validate per-topic prompt counts and uniqueness inside `completeOnboardingSetup()` or the tracked-prompt repository before writes.

**Pros:**
- Protects the invariant even if other entry points reuse the repository.
- Easier to add product-specific checks beyond schema shape.

**Cons:**
- Duplicates some validation unless paired with schema improvements.

**Effort:** 2-3 hours

**Risk:** Low

## Recommended Action

To be filled during triage.

## Technical Details

Affected files:
- [components/onboarding/onboarding-wizard.tsx](/Users/saksham/conductor/workspaces/sitebench/delhi/components/onboarding/onboarding-wizard.tsx:656)
- [lib/onboarding/types.ts](/Users/saksham/conductor/workspaces/sitebench/delhi/lib/onboarding/types.ts:72)
- [lib/onboarding/finalize.ts](/Users/saksham/conductor/workspaces/sitebench/delhi/lib/onboarding/finalize.ts:51)
- [lib/tracked-prompts/repository.ts](/Users/saksham/conductor/workspaces/sitebench/delhi/lib/tracked-prompts/repository.ts:24)

## Resources

- Review source branch: `sushii2/onboarding-ui-polish`
- Verification: `npm test`, `npm run typecheck`, `npm run lint`

## Acceptance Criteria

- [ ] The completion API rejects topics with fewer than two prompts.
- [ ] The completion API rejects duplicate prompts within the same topic.
- [ ] A server-side test proves onboarding cannot be marked complete without a valid prompt set.

## Work Log

### 2026-04-17 - Review Discovery

**By:** Codex

**Actions:**
- Compared the wizard's client validation to the server Zod schemas.
- Traced the prompt payload from the route into the tracked-prompt sync.
- Confirmed the server can complete onboarding without the UI's prompt minimums.

**Learnings:**
- Product invariants currently live only in the browser for this step.

