---
status: pending
priority: p2
issue_id: "004"
tags: [dashboard, tests, performance]
dependencies: []
---

# Dashboard home regression breaks the test suite

The new dashboard home page does not pass the existing automated test suite. `npm test` currently fails because the home-page render test times out after the analytics view and chart stack are added.

## Findings

- `npm test` fails on `tests/app/dashboard-pages.test.tsx` with `Test timed out in 5000ms`. The failing case is the Home page render assertion.
- The regression is in the branch as reviewed; `npm run typecheck` and `npm run lint` complete without errors.
- The Home page now renders a much heavier component tree, including multiple chart/table widgets and Recharts-based visualizations. See [app/dashboard/page.tsx](/Users/saksham/conductor/workspaces/sitebench/delhi/app/dashboard/page.tsx:1) and [components/dashboard/home/dashboard-home.tsx](/Users/saksham/conductor/workspaces/sitebench/delhi/components/dashboard/home/dashboard-home.tsx:31).

## Proposed Solutions

### Option 1: Stabilize the test environment for chart-heavy components

**Approach:** Mock or shallow the chart layer in page tests so the test asserts page composition instead of paying the full rendering cost of every visualization.

**Pros:**
- Fastest route to a stable suite.
- Keeps page-level intent clear.

**Cons:**
- Lowers end-to-end fidelity for that specific test.

**Effort:** 1-2 hours

**Risk:** Low

---

### Option 2: Reduce synchronous render cost in the dashboard home tree

**Approach:** Split or defer the heaviest widgets so initial render in both tests and production is lighter.

**Pros:**
- Improves real UI responsiveness as well as tests.
- Better long-term architecture.

**Cons:**
- More invasive than fixing the test harness.

**Effort:** 3-6 hours

**Risk:** Medium

## Recommended Action

To be filled during triage.

## Technical Details

Affected files:
- [tests/app/dashboard-pages.test.tsx](/Users/saksham/conductor/workspaces/sitebench/delhi/tests/app/dashboard-pages.test.tsx:38)
- [app/dashboard/page.tsx](/Users/saksham/conductor/workspaces/sitebench/delhi/app/dashboard/page.tsx:1)
- [components/dashboard/home/dashboard-home.tsx](/Users/saksham/conductor/workspaces/sitebench/delhi/components/dashboard/home/dashboard-home.tsx:31)

## Resources

- Verification commands:
  - `npm test`
  - `npm run typecheck`
  - `npm run lint`

## Acceptance Criteria

- [ ] `npm test` passes on the branch.
- [ ] The Home page render test remains deterministic in CI.
- [ ] The chosen fix preserves meaningful coverage of the dashboard home entrypoint.

## Work Log

### 2026-04-17 - Review Discovery

**By:** Codex

**Actions:**
- Ran the branch verification commands.
- Captured the failing test name and timeout output.
- Confirmed typecheck and lint still pass.

**Learnings:**
- The regression is currently limited to the test suite signal, but it blocks a clean verification pass for the branch.
