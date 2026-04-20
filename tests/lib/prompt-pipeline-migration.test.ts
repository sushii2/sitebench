import { readFileSync } from "node:fs"
import { resolve } from "node:path"

import { describe, expect, it } from "vitest"

describe("prompt pipeline migration", () => {
  it("adds the prompt pipeline schema, rpc helpers, and replay fields", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "db/migrations/0007_prompt_pipeline.sql"),
      "utf8"
    )

    expect(migration).toContain("INSERT INTO ai_platforms (code, label, sort_order)")
    expect(migration).toContain("('perplexity', 'Perplexity'")
    expect(migration).toContain("CREATE TABLE prompt_pipeline_configs")
    expect(migration).toContain("CREATE TABLE prompt_pipeline_config_prompts")
    expect(migration).toContain("CREATE TABLE prompt_pipeline_runs")
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS pipeline_run_id")
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS last_chat_prompt_run_id")
    expect(migration).toContain("claim_due_prompt_pipeline_configs")
    expect(migration).toContain("current_timestamp_value TIMESTAMPTZ")
    expect(migration).toContain("begin_prompt_pipeline_run")
    expect(migration).toContain("record_prompt_platform_result")
    expect(migration).toContain("finalize_prompt_run")
    expect(migration).toContain("finalize_prompt_pipeline_run")
    expect(migration).toContain("SECURITY DEFINER")
    expect(migration).toContain("auth.uid()")
  })

  it("patches begin_prompt_pipeline_run to qualify pipeline_run_id references", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "db/migrations/0008_fix_prompt_pipeline_begin_run_rpc.sql"
      ),
      "utf8"
    )

    expect(migration).toContain("CREATE OR REPLACE FUNCTION begin_prompt_pipeline_run")
    expect(migration).toContain(
      "WHERE prompt_pipeline_runs.id = begin_prompt_pipeline_run.pipeline_run_id"
    )
    expect(migration).toContain("begin_prompt_pipeline_run.pipeline_run_id")
    expect(migration).not.toContain("WHERE id = pipeline_run_id;")
  })

  it("patches record_prompt_platform_result to avoid ambiguous conflict targets", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "db/migrations/0009_fix_prompt_pipeline_record_result_rpc.sql"
      ),
      "utf8"
    )

    expect(migration).toContain(
      "CREATE OR REPLACE FUNCTION record_prompt_platform_result"
    )
    expect(migration).toContain(
      "ON CONFLICT ON CONSTRAINT prompt_run_responses_prompt_run_id_platform_code_key DO UPDATE"
    )
    expect(migration).not.toContain("ON CONFLICT (prompt_run_id, platform_code)")
  })

  it("patches record_prompt_platform_result to reuse brand entities by website host", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "db/migrations/0010_fix_prompt_pipeline_brand_entity_host_conflict.sql"
      ),
      "utf8"
    )

    expect(migration).toContain(
      "ON CONFLICT ON CONSTRAINT brand_entities_project_id_website_host_key DO NOTHING"
    )
    expect(migration).toContain(
      "AND brand_entities.website_host = canonical_website_host"
    )
    expect(migration).toContain(
      "SELECT *"
    )
    expect(migration).toContain(
      "brand_entities.normalized_name = lower(brand_item->>'name')"
    )
  })

  it("patches record_prompt_platform_result to upsert duplicate response brand metrics", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "db/migrations/0011_fix_prompt_pipeline_duplicate_brand_metrics.sql"
      ),
      "utf8"
    )

    expect(migration).toContain(
      "ON CONFLICT ON CONSTRAINT response_brand_metrics_response_id_brand_entity_id_key DO UPDATE"
    )
    expect(migration).toContain(
      "ON CONFLICT ON CONSTRAINT response_brand_citations_response_brand_metric_id_response_citation_id_key DO NOTHING"
    )
  })

  it("patches record_prompt_platform_result to avoid truncated response brand citation constraint names", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "db/migrations/0012_fix_prompt_pipeline_brand_citation_conflict_target.sql"
      ),
      "utf8"
    )

    expect(migration).toContain(
      "ON CONFLICT (response_brand_metric_id, response_citation_id) DO NOTHING"
    )
    expect(migration).not.toContain(
      "response_brand_citations_response_brand_metric_id_response_citation_id_key"
    )
  })

  it("adds prompt pipeline run traces and cancelled workflow reconciliation", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "db/migrations/0013_prompt_pipeline_run_traces.sql"
      ),
      "utf8"
    )

    expect(migration).toContain("CREATE TABLE prompt_pipeline_run_traces")
    expect(migration).toContain("cancelled")
    expect(migration).toContain("CREATE OR REPLACE FUNCTION record_prompt_pipeline_run_trace")
    expect(migration).toContain("CREATE OR REPLACE FUNCTION cancel_prompt_pipeline_run")
  })

  it("adds prompt pipeline termination cleanup for active runs", () => {
    const migration = readFileSync(
      resolve(
        process.cwd(),
        "db/migrations/0014_terminate_prompt_pipeline_run.sql"
      ),
      "utf8"
    )

    expect(migration).toContain("CREATE OR REPLACE FUNCTION terminate_prompt_pipeline_run")
    expect(migration).toContain("DELETE FROM prompt_runs")
    expect(migration).toContain("DELETE FROM prompt_pipeline_runs")
    expect(migration).toContain("last_pipeline_run_id = NULL")
    expect(migration).toContain("auth.uid()")
  })
})
