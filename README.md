# Sitebench

Sitebench is an AI visibility and brand intelligence app for teams that want to understand how they appear inside answer engines like ChatGPT, Claude, and Perplexity.

It combines guided onboarding, structured site analysis, prompt tracking, scheduled multi-provider prompt runs, citation capture, and dashboard reporting in a single Next.js application.

## What This Project Does

- Onboards a brand with company, website, competitors, topics, and prompt-tracking inputs.
- Scrapes and analyzes a company site to generate structured brand context.
- Produces onboarding topic and prompt suggestions from brand and site evidence.
- Runs tracked prompts across multiple LLM providers on a schedule or on demand.
- Persists raw responses, extracted citations, and brand-level visibility metrics.
- Surfaces prompt, chat, citation, and dashboard views for ongoing monitoring.

## Product Surface

### Public routes

- `/` landing page for the product.
- `/login` and `/sign-up` auth entry points.
- `/onboarding` guided setup flow.

### Dashboard routes

- `/dashboard` overview with KPI and prompt-run controls.
- `/dashboard/chats` prompt run history with filters.
- `/dashboard/chats/[promptRunId]` run detail view.
- `/dashboard/prompts` tracked prompts and prompt metrics by platform.
- `/dashboard/insights`, `/dashboard/queries`, and `/dashboard/sources` exist, but are still largely placeholder pages.

### API routes

- `/api/onboard-brand`
- `/api/onboarding/analysis`
- `/api/onboarding/complete`
- `/api/onboarding/topic-prompts`
- `/api/prompt-runs/config`
- `/api/prompt-runs/trigger`

## Architecture At A Glance

```text
Next.js app
  -> InsForge auth + database
  -> Workflow onboarding analysis pipeline
  -> Trigger.dev scheduled prompt-run pipeline
  -> AI SDK model execution
       -> OpenAI
       -> Anthropic
       -> Perplexity
  -> Firecrawl site discovery and scraping
  -> Vercel Blob raw response archival
```

## Technologies Used

### Application stack

- Next.js 16 with App Router and Turbopack for local dev.
- React 19 and TypeScript 5.
- Tailwind CSS 4, PostCSS, and `tw-animate-css`.
- shadcn/ui, Radix primitives, HugeIcons, Sonner, and Recharts.

### Data and backend

- InsForge SDK for auth and Postgres-backed data access.
- SQL migrations in [`db/migrations`](/Users/saksham/conductor/workspaces/sitebench/chennai-v1/db/migrations).
- Row-level security policies for user-owned data.

### AI and workflow stack

- Vercel AI SDK via `ai`, `@ai-sdk/openai`, and `@ai-sdk/anthropic`.
- `workflow` / `workflow/next` for the onboarding analysis workflow.
- Trigger.dev for scheduled and manual background prompt runs.
- Firecrawl for site mapping and page scraping.
- Vercel Blob for raw response JSON storage.
- Zod for request, env, and structured-output validation.

### Quality and tooling

- Vitest with Testing Library and JSDOM.
- ESLint with Next.js core-web-vitals and TypeScript rules.
- Prettier with `prettier-plugin-tailwindcss`.

## Multi-Agent Systems And Pipelines

This repo contains two real application pipelines and one agent-oriented development layer.

### 1. Onboarding analysis pipeline

The onboarding analysis flow is defined in [`workflows/onboarding-analysis`](/Users/saksham/conductor/workspaces/sitebench/chennai-v1/workflows/onboarding-analysis).

Current orchestrated steps:

1. Initialize a crawl/analysis run.
2. Scrape the homepage.
3. Build a seed brand profile.
4. Enhance the brand profile.
5. Generate competitor candidates.
6. Generate onboarding topics and prompts.
7. Finalize the run or fail it with persisted warnings.

Supporting step modules also exist for:

- site mapping
- homepage classification
- critical page selection
- selected-page scraping
- page signal extraction
- competitor scoring

The flow persists run state in `site_crawl_runs`, `site_crawl_pages`, and `site_crawl_mapped_pages`.

### 2. Prompt-run orchestration pipeline

The scheduled prompt-run system lives in [`src/trigger/prompt-runs`](/Users/saksham/conductor/workspaces/sitebench/chennai-v1/src/trigger/prompt-runs).

Configured stages:

1. Hourly scheduler checks for due prompt-run configs.
2. Dispatcher claims eligible projects.
3. Orchestrator loads topics, tracked prompts, brands, and schedule state.
4. Provider execution fans out across ChatGPT, Claude, and Perplexity.
5. Analyzer computes citations, mention counts, visibility, sentiment, and rankings.
6. Persistence layer writes prompt runs, responses, metrics, citations, domains, pages, and blob URLs.

Notable runtime behavior:

- Scheduled runs use a cron job: `0 * * * *`.
- Provider execution is queue-based with per-provider concurrency controls.
- Manual runs are exposed through `/api/prompt-runs/trigger`.
- Realtime run status is surfaced in the dashboard with `@trigger.dev/react-hooks`.

### 3. Agent-oriented development workflow

The repo is also set up for agent-assisted development.

Relevant files and folders:

- [`AGENTS.md`](/Users/saksham/conductor/workspaces/sitebench/chennai-v1/AGENTS.md)
- [`CLAUDE.md`](/Users/saksham/conductor/workspaces/sitebench/chennai-v1/CLAUDE.md)
- [`docs/superpowers`](/Users/saksham/conductor/workspaces/sitebench/chennai-v1/docs/superpowers)
- [`todos`](/Users/saksham/conductor/workspaces/sitebench/chennai-v1/todos)
- [`.context`](/Users/saksham/conductor/workspaces/sitebench/chennai-v1/.context)

Those files are not part of the product runtime, but they do define how coding agents collaborate, track work, and execute implementation plans inside this workspace.

## Data Model Summary

The core schema is documented in [`docs/database/brand-intelligence-schema.md`](/Users/saksham/conductor/workspaces/sitebench/chennai-v1/docs/database/brand-intelligence-schema.md).

Key tables:

- `tracking_projects`
- `brand_entities`
- `project_topics`
- `tracked_prompts`
- `prompt_runs`
- `prompt_run_responses`
- `response_brand_metrics`
- `response_citations`
- `source_domains`
- `source_pages`
- `site_crawl_runs`
- `site_crawl_pages`
- `site_crawl_mapped_pages`
- `prompt_run_configs`

This schema separates:

- project ownership
- onboarding-derived brand context
- tracked prompts
- prompt execution history
- parsed response analytics
- citation/source normalization

## Environment Variables

The codebase currently expects these environment variables:

### Required for core app access

- `NEXT_PUBLIC_INSFORGE_URL`
- `NEXT_PUBLIC_INSFORGE_ANON_KEY`
- `INSFORGE_API_KEY`

### Required for onboarding analysis

- `FIRECRAWL_API_KEY`

### Required for AI model execution

- `AI_GATEWAY_API_KEY`
- `ANTHROPIC_API_KEY`

### Required for external logos in the UI

- `NEXT_PUBLIC_LOGO_DEV_PUBLISHABLE_KEY`

### Likely required for blob persistence

- Vercel Blob server credentials for `@vercel/blob`.

The last item is inferred from the raw-response upload code and depends on how you run the app locally or in deployment.

## Local Development

### Prerequisites

- Node.js 22 is the safest local choice to match the Trigger.dev runtime.
- npm is used in this repo.
- Access to an InsForge backend.
- Access to Firecrawl.
- Access to the configured AI providers and gateway.

### Install

```bash
npm install
```

### Start the web app

```bash
npm run dev
```

### Start Trigger.dev local development

```bash
npm run trigger
```

### Run checks

```bash
npm test
npm run typecheck
npm run lint
```

## Database And Migrations

SQL migrations live in [`db/migrations`](/Users/saksham/conductor/workspaces/sitebench/chennai-v1/db/migrations).

Important migration groups:

- `0001` creates the core brand intelligence schema.
- `0002` and `0003` handle legacy backfill and cleanup.
- `0004`, `0005`, and `0006` add onboarding crawl and workflow persistence.
- `0007` adds prompt-run scheduling config.
- `0008` adds blob URL storage for raw responses.
- `0009` tightens source metadata read access with RLS policies.

If onboarding analysis fails with missing-table errors, the code explicitly expects the onboarding analysis migrations to be applied before use.

## Deployment Notes

### Vercel deployment validation

The repo includes a GitHub Actions workflow at [`.github/workflows/validate-vercel-deployment.yml`](/Users/saksham/conductor/workspaces/sitebench/chennai-v1/.github/workflows/validate-vercel-deployment.yml).

What it does:

- listens for successful deployment status events
- targets the `master` branch deployment
- curls the deployed homepage
- reports a commit status back to GitHub

### Next.js configuration

The Next.js config wraps the app with `withWorkflow(nextConfig)` and allows remote images from `img.logo.dev`.

## MCP And Local Tooling

The local MCP config in [`.mcp.json`](/Users/saksham/conductor/workspaces/sitebench/chennai-v1/.mcp.json) currently wires up:

- shadcn MCP
- Trigger.dev MCP
- InsForge MCP

Do not commit live secrets in MCP config or environment files.

## Repository Map

```text
app/                 Next.js routes and API handlers
components/          UI and dashboard components
db/migrations/       SQL schema and migration history
docs/                architecture notes, plans, and specs
lib/                 domain logic, repositories, config, and adapters
src/trigger/         Trigger.dev background jobs
tests/               unit and component tests
todos/               tracked engineering issues and follow-up work
workflows/           onboarding workflow definitions and steps
```

## Current State

The app has a real onboarding and prompt-run backbone, but parts of the dashboard are still mid-build. Some views already load real project data, while others are clearly scaffolded or backed by mock metrics.

That makes this repository a working product foundation rather than a finished analytics platform.
