# Brand Intelligence Schema

## Summary
- Tenant model: one `tracking_projects` row per authenticated user in v1.
- Canonical company identity lives in `brand_entities`, with one `primary` brand and zero or more `competitor` brands per project.
- User-managed onboarding topics live in `project_topics`.
- Prompt research uses a global `prompt_catalog` plus project-scoped `tracked_prompts`.
- Execution is stored at three grains: `prompt_runs`, `prompt_run_responses`, and parsed facts such as `response_brand_metrics` and `response_citations`.
- Dashboard reads should prefer the `vw_*` views over ad hoc joins.

## Table Dictionary

### `tracking_projects`
- Root tenant row for all user-owned data.
- Owns onboarding status, reporting timezone, and project-level settings.

### `brand_entities`
- Canonical brand/company identity inside a project.
- Stores both the customer’s primary brand and tracked competitors.
- Constraints enforce one primary brand per project and prevent duplicate names or domains.

### `topic_catalog`
- System topic library for normalization and future curated experiences.

### `project_topics`
- User-owned topics selected during onboarding and later editing.
- Stores the default cadence for prompts under each topic.

### `prompt_catalog`
- Global reusable prompt/query library for research and seeding.

### `prompt_market_metrics`
- Historical prompt trend and volume observations by platform.

### `ai_platforms`
- Lookup table for supported LLM platforms such as ChatGPT, Claude, Gemini, and Grok.

### `project_platforms`
- Project-level enablement state for each supported platform.

### `tracked_prompts`
- Prompts that a specific project has chosen to track under one topic.
- Supports both catalog-backed prompts and fully custom prompts.

### `prompt_runs`
- One logical execution of one tracked prompt for one project/topic at one scheduled moment.

### `prompt_run_responses`
- One provider response within a `prompt_run`.
- Stores raw text/JSON, parser version, latency, status, and token metadata.

### `response_brand_metrics`
- Parsed brand-level facts from one provider response.
- Powers visibility, ranking, sentiment, recommendation rate, and citation score reporting.

### `source_domains`
- Canonical domain registry for cited sources.

### `source_pages`
- Canonical page registry underneath a domain.

### `response_citations`
- One cited source occurrence inside one provider response.

### `response_brand_citations`
- Attribution join between a parsed brand metric row and a cited source occurrence.

## Relationship Diagram
```text
auth.users
  -> tracking_projects
    -> brand_entities
    -> project_topics
    -> project_platforms
    -> tracked_prompts
      -> prompt_runs
        -> prompt_run_responses
          -> response_brand_metrics
          -> response_citations
            -> response_brand_citations

topic_catalog -> project_topics
topic_catalog -> prompt_catalog
prompt_catalog -> prompt_market_metrics
prompt_catalog -> tracked_prompts
ai_platforms -> prompt_market_metrics
ai_platforms -> project_platforms
ai_platforms -> prompt_run_responses
source_domains -> source_pages -> response_citations
```

## Data Grain Rules
- `prompt_runs` is the parent job grain: one tracked prompt execution.
- `prompt_run_responses` is the provider-response grain: one row per platform answer.
- `response_citations` is the citation-occurrence grain: one row per cited source occurrence inside one response.
- `response_brand_metrics` is the parsed brand-fact grain: one row per brand found in one response.

Do not collapse those grains into a single table. Multi-provider comparisons, partial failures, and citation analytics all depend on them staying separate.

## RLS Matrix
- User-owned full CRUD:
  - `tracking_projects`
  - `brand_entities`
  - `project_topics`
  - `project_platforms`
  - `tracked_prompts`
- Authenticated read-only catalogs:
  - `topic_catalog`
  - `prompt_catalog`
  - `prompt_market_metrics`
  - `ai_platforms`
- Authenticated read, service-role write:
  - `prompt_runs`
  - `prompt_run_responses`
  - `response_brand_metrics`
  - `response_citations`
  - `response_brand_citations`

## Dashboard View Mapping
- Home KPI cards: `vw_dashboard_kpis`
- Visibility chart: `vw_visibility_trends`
- Provider rankings table: `vw_provider_rankings`
- Topic leaderboard widget: `vw_topic_leaderboard`
- Content gaps widget: `vw_content_gap_prompts`
- Citation sources page/widget: `vw_citation_sources`
- Weekly updates and deltas: `vw_weekly_rank_deltas`

## Current App Adapter
- The migration is greenfield, but the app still exposes a compatibility onboarding shape through `lib/brands`.
- Compatibility object:
  - `id` maps to `tracking_projects.id`
  - `company_name`, `website`, and `description` map to the primary `brand_entities` row
  - `topics` maps to the ordered `project_topics.name` list
  - `competitors` maps to `brand_entities` rows where `role = 'competitor'`

This keeps onboarding and the mocked dashboard usable while the rest of the UI is migrated to project-native types.

## Future Migration Notes
- Legacy bootstrap/backfill lives in `db/migrations/0002_backfill_legacy_brand_data.sql`.
- Legacy table removal lives in `db/migrations/0003_drop_legacy_brand_tables.sql`.
- Add prompt selection and cadence management UI against `tracked_prompts`.
- Add platform enablement UI against `project_platforms`.
- Move dashboard widgets from mock data to `vw_*` queries.
- Add parser/ingestion server code for `prompt_runs`, `prompt_run_responses`, `response_brand_metrics`, and citation tables.
- If the product moves to team accounts, replace `tracking_projects.user_id unique` with a membership model and keep the rest of the schema largely intact.
