# Onboarding Prompt Quality Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current template-heavy onboarding topic and prompt generation flow with a structured multi-step pipeline that derives topics and prompts from a selective site crawl plus a brand profile, while keeping web search as a separate scoring pass.

**Architecture:** Keep the existing async onboarding analysis run and selective crawl. Replace the current deterministic topic and prompt rendering with two structured-output steps: brand profile extraction and demand-scenario prompt generation. Use gateway-safe JSON schemas for topic generation and prompt scoring so the LLM path does not silently fall back to low-quality deterministic output.

**Tech Stack:** Next.js 16, TypeScript, Vitest, AI SDK gateway models, Firecrawl, Zod 4

---

### Task 1: Lock the new behavior in tests

**Files:**
- Modify: `tests/lib/onboarding-topic-prompt-generator.test.ts`
- Modify: `tests/lib/onboarding-analysis.test.ts`
- Modify: `tests/lib/onboarding-types.test.ts`

**Step 1: Write the failing tests**

- Add generator tests that require prompt output to be driven by a structured brand profile and to include demand metadata instead of hardcoded template-only prompt families.
- Add analysis tests that require the pipeline to call a brand-profile step, a topic-generation step, and a prompt-generation step before web-search scoring.
- Add schema tests that require gateway-safe prompt/topic schemas with all required keys present.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/onboarding-topic-prompt-generator.test.ts tests/lib/onboarding-analysis.test.ts tests/lib/onboarding-types.test.ts`

Expected: FAIL because the current generator still uses deterministic templates and the current structured-output schemas are not the new gateway-safe shapes.

**Step 3: Write minimal implementation**

- Introduce the new structured types and JSON-schema helpers.
- Thread brand profile data through topic and prompt generation.
- Update tests only if they are asserting removed legacy behavior.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/onboarding-topic-prompt-generator.test.ts tests/lib/onboarding-analysis.test.ts tests/lib/onboarding-types.test.ts`

Expected: PASS

### Task 2: Replace deterministic topic/prompt generation with structured generation

**Files:**
- Modify: `lib/onboarding/types.ts`
- Modify: `lib/onboarding/analysis.ts`
- Modify: `lib/onboarding/topic-prompt-generator.ts`
- Modify: `lib/onboarding/index.ts`
- Delete or minimize legacy-only prompt template dependencies in `lib/onboarding/topic-prompt-templates.ts`

**Step 1: Write the failing test**

- Extend the prompt-generator test to assert that prompts come from a `brandProfile` plus topic intent, not just `description` plus topic name.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/onboarding-topic-prompt-generator.test.ts`

Expected: FAIL because `generateTopicPromptCollection()` does not accept or use a structured brand profile.

**Step 3: Write minimal implementation**

- Define a structured `onboardingBrandProfileSchema` with category, audiences, use cases, differentiators, adjacent categories, competitors, description, and evidence URLs.
- Define a structured prompt-generation schema that returns prompts plus metadata such as persona, segment, intent type, purchase stage, likely competitors, brand relevance, and rationale.
- Update `generateTopicPromptCollection()` to call the structured prompt-generation step and keep prompt scoring metadata separate from generation metadata.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/onboarding-topic-prompt-generator.test.ts`

Expected: PASS

### Task 3: Make the analysis pipeline resilient and gateway-safe

**Files:**
- Modify: `lib/onboarding/analysis.ts`
- Modify: `tests/lib/onboarding-analysis.test.ts`
- Modify: `tests/app/onboarding-topic-prompts-route.test.ts`

**Step 1: Write the failing test**

- Add assertions that analysis uses selective crawl context to build a brand profile, then topic generation, then prompt generation, then web-search scoring.
- Add assertions that prompt scoring no longer falls back because of unsupported gateway schema constructs.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/lib/onboarding-analysis.test.ts tests/app/onboarding-topic-prompts-route.test.ts`

Expected: FAIL because the current pipeline still uses deterministic prompt construction and brittle `Output.object` schemas.

**Step 3: Write minimal implementation**

- Replace brittle structured-output calls with gateway-safe JSON schema wrappers where needed.
- Stop silently generating low-quality prompts when the higher-quality path fails; instead, emit warnings and use a constrained fallback path.
- Keep web search limited to prompt scoring and competitor validation.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/lib/onboarding-analysis.test.ts tests/app/onboarding-topic-prompts-route.test.ts`

Expected: PASS

### Task 4: Verify the full surface

**Files:**
- Modify: any touched files above

**Step 1: Run the focused suite**

Run: `npm test -- tests/lib/onboarding-topic-prompt-generator.test.ts tests/lib/onboarding-analysis.test.ts tests/lib/onboarding-types.test.ts tests/app/onboarding-topic-prompts-route.test.ts`

Expected: PASS

**Step 2: Run repo verification**

Run: `npm test`
Run: `npm run typecheck`
Run: `npm run lint`

Expected: PASS
