INSERT INTO ai_platforms (code, label, sort_order)
VALUES ('perplexity', 'Perplexity', 2)
ON CONFLICT (code) DO UPDATE
SET label = EXCLUDED.label,
    sort_order = EXCLUDED.sort_order,
    is_active = TRUE,
    updated_at = NOW();

INSERT INTO project_platforms (project_id, platform_code, is_enabled)
SELECT tracking_projects.id, 'perplexity', TRUE
FROM tracking_projects
ON CONFLICT (project_id, platform_code) DO NOTHING;

CREATE TABLE prompt_pipeline_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES tracking_projects(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (
    frequency IN (
      'daily',
      'every_2_days',
      'every_3_days',
      'weekly',
      'every_2_weeks'
    )
  ),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  next_run_at TIMESTAMPTZ NULL,
  last_run_at TIMESTAMPTZ NULL,
  last_run_status TEXT NULL CHECK (
    last_run_status IN ('queued', 'running', 'completed', 'partial', 'failed')
  ),
  last_failure_message TEXT NULL,
  last_pipeline_run_id UUID NULL,
  anchor_timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE prompt_pipeline_config_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id UUID NOT NULL REFERENCES prompt_pipeline_configs(id) ON DELETE CASCADE,
  tracked_prompt_id UUID NOT NULL REFERENCES tracked_prompts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (config_id, tracked_prompt_id)
);

CREATE TABLE prompt_pipeline_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
  config_id UUID NOT NULL REFERENCES prompt_pipeline_configs(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('scheduled', 'manual')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'partial', 'failed')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  workflow_run_id TEXT NULL,
  request_id TEXT NULL,
  selection_snapshot_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  prompt_count_total INTEGER NOT NULL DEFAULT 0,
  prompt_count_completed INTEGER NOT NULL DEFAULT 0,
  prompt_count_partial INTEGER NOT NULL DEFAULT 0,
  prompt_count_failed INTEGER NOT NULL DEFAULT 0,
  failure_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE prompt_runs
  ADD COLUMN IF NOT EXISTS pipeline_run_id UUID NULL REFERENCES prompt_pipeline_runs(id) ON DELETE SET NULL;

ALTER TABLE prompt_runs
  DROP CONSTRAINT IF EXISTS prompt_runs_cadence_applied_check;

ALTER TABLE prompt_runs
  ADD CONSTRAINT prompt_runs_cadence_applied_check
  CHECK (
    cadence_applied IN (
      'manual',
      'daily',
      'every_2_days',
      'every_3_days',
      'weekly',
      'every_2_weeks'
    )
  );

ALTER TABLE tracked_prompts
  ADD COLUMN IF NOT EXISTS last_run_status TEXT NULL
    CHECK (last_run_status IN ('queued', 'running', 'completed', 'partial', 'failed'));

ALTER TABLE tracked_prompts
  ADD COLUMN IF NOT EXISTS last_failure_message TEXT NULL;

ALTER TABLE tracked_prompts
  ADD COLUMN IF NOT EXISTS last_chat_prompt_run_id UUID NULL REFERENCES prompt_runs(id) ON DELETE SET NULL;

ALTER TABLE prompt_pipeline_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_pipeline_config_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_pipeline_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt_pipeline_configs_select_own" ON prompt_pipeline_configs
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = prompt_pipeline_configs.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "prompt_pipeline_configs_insert_own" ON prompt_pipeline_configs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = prompt_pipeline_configs.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "prompt_pipeline_configs_update_own" ON prompt_pipeline_configs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = prompt_pipeline_configs.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = prompt_pipeline_configs.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "prompt_pipeline_configs_delete_own" ON prompt_pipeline_configs
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = prompt_pipeline_configs.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "prompt_pipeline_config_prompts_select_own" ON prompt_pipeline_config_prompts
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM prompt_pipeline_configs
      JOIN tracking_projects
        ON tracking_projects.id = prompt_pipeline_configs.project_id
      WHERE prompt_pipeline_configs.id = prompt_pipeline_config_prompts.config_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "prompt_pipeline_config_prompts_insert_own" ON prompt_pipeline_config_prompts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM prompt_pipeline_configs
      JOIN tracking_projects
        ON tracking_projects.id = prompt_pipeline_configs.project_id
      WHERE prompt_pipeline_configs.id = prompt_pipeline_config_prompts.config_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "prompt_pipeline_config_prompts_update_own" ON prompt_pipeline_config_prompts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM prompt_pipeline_configs
      JOIN tracking_projects
        ON tracking_projects.id = prompt_pipeline_configs.project_id
      WHERE prompt_pipeline_configs.id = prompt_pipeline_config_prompts.config_id
        AND tracking_projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM prompt_pipeline_configs
      JOIN tracking_projects
        ON tracking_projects.id = prompt_pipeline_configs.project_id
      WHERE prompt_pipeline_configs.id = prompt_pipeline_config_prompts.config_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "prompt_pipeline_config_prompts_delete_own" ON prompt_pipeline_config_prompts
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM prompt_pipeline_configs
      JOIN tracking_projects
        ON tracking_projects.id = prompt_pipeline_configs.project_id
      WHERE prompt_pipeline_configs.id = prompt_pipeline_config_prompts.config_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "prompt_pipeline_runs_select_own" ON prompt_pipeline_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = prompt_pipeline_runs.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE INDEX prompt_pipeline_configs_project_id_idx
  ON prompt_pipeline_configs (project_id);

CREATE INDEX prompt_pipeline_runs_config_id_idx
  ON prompt_pipeline_runs (config_id, created_at DESC);

CREATE INDEX prompt_pipeline_runs_project_status_idx
  ON prompt_pipeline_runs (project_id, status);

CREATE INDEX prompt_runs_pipeline_run_id_idx
  ON prompt_runs (pipeline_run_id);

CREATE INDEX tracked_prompts_last_chat_prompt_run_id_idx
  ON tracked_prompts (last_chat_prompt_run_id);

CREATE OR REPLACE FUNCTION prompt_pipeline_frequency_interval(frequency_value TEXT)
RETURNS INTERVAL
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN CASE frequency_value
    WHEN 'daily' THEN INTERVAL '1 day'
    WHEN 'every_2_days' THEN INTERVAL '2 days'
    WHEN 'every_3_days' THEN INTERVAL '3 days'
    WHEN 'weekly' THEN INTERVAL '7 days'
    WHEN 'every_2_weeks' THEN INTERVAL '14 days'
    ELSE INTERVAL '7 days'
  END;
END;
$$;

CREATE OR REPLACE FUNCTION claim_due_prompt_pipeline_configs(
  limit_count INTEGER,
  current_timestamp_value TIMESTAMPTZ
)
RETURNS TABLE (
  config_id UUID,
  project_id UUID,
  frequency TEXT,
  scheduled_for TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due_configs AS (
    SELECT cfg.id, cfg.project_id, cfg.frequency, cfg.next_run_at
    FROM prompt_pipeline_configs cfg
    WHERE cfg.is_enabled = TRUE
      AND cfg.next_run_at IS NOT NULL
      AND cfg.next_run_at <= current_timestamp_value
      AND NOT EXISTS (
        SELECT 1
        FROM prompt_pipeline_runs run
        WHERE run.config_id = cfg.id
          AND run.status IN ('queued', 'running')
      )
    ORDER BY cfg.next_run_at ASC
    LIMIT limit_count
    FOR UPDATE
  ),
  advanced AS (
    UPDATE prompt_pipeline_configs cfg
    SET next_run_at = due_configs.next_run_at + prompt_pipeline_frequency_interval(cfg.frequency)
    FROM due_configs
    WHERE cfg.id = due_configs.id
    RETURNING cfg.id, cfg.project_id, cfg.frequency, due_configs.next_run_at
  )
  SELECT advanced.id, advanced.project_id, advanced.frequency, advanced.next_run_at
  FROM advanced;
END;
$$;

CREATE OR REPLACE FUNCTION begin_prompt_pipeline_run(
  pipeline_run_id UUID,
  project_id UUID,
  config_id UUID,
  trigger_type TEXT,
  scheduled_for TIMESTAMPTZ,
  request_id TEXT,
  workflow_run_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_run prompt_pipeline_runs%ROWTYPE;
BEGIN
  SELECT *
  INTO existing_run
  FROM prompt_pipeline_runs
  WHERE id = pipeline_run_id;

  IF NOT FOUND THEN
    INSERT INTO prompt_pipeline_runs (
      id,
      project_id,
      config_id,
      trigger_type,
      status,
      scheduled_for,
      workflow_run_id,
      request_id,
      selection_snapshot_json,
      prompt_count_total
    )
    SELECT
      pipeline_run_id,
      begin_prompt_pipeline_run.project_id,
      begin_prompt_pipeline_run.config_id,
      begin_prompt_pipeline_run.trigger_type,
      'running',
      begin_prompt_pipeline_run.scheduled_for,
      begin_prompt_pipeline_run.workflow_run_id,
      begin_prompt_pipeline_run.request_id,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'tracked_prompt_id', tp.id,
            'project_topic_id', tp.project_topic_id,
            'topic_name', pt.name,
            'prompt_text', tp.prompt_text
          )
          ORDER BY tp.created_at
        ),
        '[]'::jsonb
      ),
      COUNT(tp.id)
    FROM prompt_pipeline_config_prompts cfg_prompt
    JOIN tracked_prompts tp
      ON tp.id = cfg_prompt.tracked_prompt_id
    JOIN project_topics pt
      ON pt.id = tp.project_topic_id
    WHERE cfg_prompt.config_id = begin_prompt_pipeline_run.config_id;

    INSERT INTO prompt_runs (
      project_id,
      project_topic_id,
      tracked_prompt_id,
      pipeline_run_id,
      trigger_type,
      cadence_applied,
      status,
      scheduled_for,
      started_at
    )
    SELECT
      tp.project_id,
      tp.project_topic_id,
      tp.id,
      pipeline_run_id,
      CASE
        WHEN begin_prompt_pipeline_run.trigger_type = 'manual' THEN 'manual'
        ELSE 'scheduled'
      END,
      CASE
        WHEN begin_prompt_pipeline_run.trigger_type = 'manual' THEN 'manual'
        ELSE cfg.frequency
      END,
      'running',
      begin_prompt_pipeline_run.scheduled_for,
      NOW()
    FROM prompt_pipeline_config_prompts cfg_prompt
    JOIN tracked_prompts tp
      ON tp.id = cfg_prompt.tracked_prompt_id
    JOIN prompt_pipeline_configs cfg
      ON cfg.id = cfg_prompt.config_id
    WHERE cfg_prompt.config_id = begin_prompt_pipeline_run.config_id
    ON CONFLICT DO NOTHING;
  ELSE
    UPDATE prompt_pipeline_runs
    SET workflow_run_id = COALESCE(begin_prompt_pipeline_run.workflow_run_id, prompt_pipeline_runs.workflow_run_id)
    WHERE id = pipeline_run_id;
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'pipeline_run',
      to_jsonb(run_row),
      'selected_prompts',
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'prompt_run_id', pr.id,
            'tracked_prompt_id', tp.id,
            'project_topic_id', tp.project_topic_id,
            'topic_name', pt.name,
            'prompt_text', tp.prompt_text
          )
          ORDER BY tp.created_at
        ) FILTER (WHERE pr.id IS NOT NULL),
        '[]'::jsonb
      )
    )
    FROM prompt_pipeline_runs run_row
    LEFT JOIN prompt_runs pr
      ON pr.pipeline_run_id = run_row.id
    LEFT JOIN tracked_prompts tp
      ON tp.id = pr.tracked_prompt_id
    LEFT JOIN project_topics pt
      ON pt.id = tp.project_topic_id
    WHERE run_row.id = pipeline_run_id
    GROUP BY run_row.id
  );
END;
$$;

CREATE OR REPLACE FUNCTION record_prompt_platform_result(
  prompt_run_id UUID,
  platform_code TEXT,
  provider_model TEXT,
  raw_response_text TEXT,
  raw_response_json JSONB,
  status TEXT,
  latency_ms INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  error_code TEXT,
  error_message TEXT,
  parsed_citations_json JSONB,
  parsed_brands_json JSONB,
  parser_warnings TEXT[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prompt_run_row prompt_runs%ROWTYPE;
  response_row_id UUID;
  citation_item JSONB;
  brand_item JSONB;
  page_record source_pages%ROWTYPE;
  domain_record source_domains%ROWTYPE;
  brand_entity_record brand_entities%ROWTYPE;
  metric_record response_brand_metrics%ROWTYPE;
BEGIN
  SELECT *
  INTO prompt_run_row
  FROM prompt_runs
  WHERE prompt_runs.id = record_prompt_platform_result.prompt_run_id;

  INSERT INTO prompt_run_responses (
    project_id,
    prompt_run_id,
    platform_code,
    provider_model,
    prompt_text,
    raw_response_text,
    raw_response_json,
    parser_version,
    status,
    latency_ms,
    input_tokens,
    output_tokens,
    error_code,
    error_message,
    responded_at
  )
  VALUES (
    prompt_run_row.project_id,
    prompt_run_row.id,
    platform_code,
    provider_model,
    (SELECT tracked_prompts.prompt_text FROM tracked_prompts WHERE tracked_prompts.id = prompt_run_row.tracked_prompt_id),
    raw_response_text,
    COALESCE(raw_response_json, '{}'::jsonb),
    'prompt_pipeline_parser_v1',
    status,
    latency_ms,
    input_tokens,
    output_tokens,
    error_code,
    error_message,
    NOW()
  )
  ON CONFLICT (prompt_run_id, platform_code) DO UPDATE
  SET provider_model = EXCLUDED.provider_model,
      raw_response_text = EXCLUDED.raw_response_text,
      raw_response_json = EXCLUDED.raw_response_json,
      parser_version = EXCLUDED.parser_version,
      status = EXCLUDED.status,
      latency_ms = EXCLUDED.latency_ms,
      input_tokens = EXCLUDED.input_tokens,
      output_tokens = EXCLUDED.output_tokens,
      error_code = EXCLUDED.error_code,
      error_message = EXCLUDED.error_message,
      responded_at = EXCLUDED.responded_at
  RETURNING id INTO response_row_id;

  DELETE FROM response_brand_citations
  WHERE response_brand_metric_id IN (
    SELECT id FROM response_brand_metrics WHERE response_id = response_row_id
  );
  DELETE FROM response_brand_metrics WHERE response_id = response_row_id;
  DELETE FROM response_citations WHERE response_id = response_row_id;

  FOR citation_item IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(parsed_citations_json, '[]'::jsonb))
  LOOP
    INSERT INTO source_domains (domain, root_domain, display_name)
    VALUES (
      lower(regexp_replace(split_part(COALESCE(citation_item->>'url', ''), '/', 3), '^www\.', '')),
      lower(regexp_replace(split_part(COALESCE(citation_item->>'url', ''), '/', 3), '^www\.', '')),
      NULLIF(citation_item->>'pageTitle', '')
    )
    ON CONFLICT (domain) DO UPDATE
    SET display_name = COALESCE(EXCLUDED.display_name, source_domains.display_name)
    RETURNING * INTO domain_record;

    INSERT INTO source_pages (domain_id, canonical_url, page_title, first_seen_at)
    VALUES (
      domain_record.id,
      citation_item->>'url',
      NULLIF(citation_item->>'pageTitle', ''),
      NOW()
    )
    ON CONFLICT (canonical_url) DO UPDATE
    SET page_title = COALESCE(EXCLUDED.page_title, source_pages.page_title)
    RETURNING * INTO page_record;

    INSERT INTO response_citations (
      project_id,
      response_id,
      source_page_id,
      citation_order,
      cited_url,
      citation_text,
      authority_score
    )
    VALUES (
      prompt_run_row.project_id,
      response_row_id,
      page_record.id,
      NULL,
      citation_item->>'url',
      NULLIF(citation_item->>'citationText', ''),
      NULLIF(citation_item->>'authorityScore', '')::NUMERIC
    );
  END LOOP;

  FOR brand_item IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(parsed_brands_json, '[]'::jsonb))
  LOOP
    SELECT *
    INTO brand_entity_record
    FROM brand_entities
    WHERE brand_entities.project_id = prompt_run_row.project_id
      AND brand_entities.normalized_name = lower(brand_item->>'name')
    LIMIT 1;

    IF NOT FOUND AND NULLIF(brand_item->>'canonicalWebsite', '') IS NOT NULL THEN
      INSERT INTO brand_entities (
        project_id,
        role,
        name,
        normalized_name,
        website_url,
        website_host,
        description,
        sort_order,
        is_active
      )
      VALUES (
        prompt_run_row.project_id,
        'competitor',
        brand_item->>'name',
        lower(brand_item->>'name'),
        brand_item->>'canonicalWebsite',
        lower(regexp_replace(split_part(brand_item->>'canonicalWebsite', '/', 3), '^www\.', '')),
        '',
        999,
        TRUE
      )
      RETURNING * INTO brand_entity_record;
    END IF;

    IF FOUND THEN
      INSERT INTO response_brand_metrics (
        project_id,
        response_id,
        brand_entity_id,
        rank_position,
        mention_count,
        visibility_score,
        recommendation_status,
        sentiment_label,
        sentiment_score,
        citation_score
      )
      VALUES (
        prompt_run_row.project_id,
        response_row_id,
        brand_entity_record.id,
        NULL,
        1,
        COALESCE(NULLIF(brand_item->>'visibilityScore', '')::NUMERIC, 0),
        COALESCE(NULLIF(brand_item->>'recommendationStatus', ''), 'mentioned'),
        COALESCE(NULLIF(brand_item->>'sentimentLabel', ''), 'neutral'),
        NULL,
        0
      )
      RETURNING * INTO metric_record;

      INSERT INTO response_brand_citations (
        project_id,
        response_brand_metric_id,
        response_citation_id,
        attribution_score
      )
      SELECT
        prompt_run_row.project_id,
        metric_record.id,
        response_citations.id,
        1
      FROM response_citations
      WHERE response_citations.response_id = response_row_id
      LIMIT 1;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION finalize_prompt_run(prompt_run_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prompt_run_row prompt_runs%ROWTYPE;
  completed_count INTEGER;
  failed_count INTEGER;
  next_status TEXT;
  failure_message TEXT;
BEGIN
  SELECT *
  INTO prompt_run_row
  FROM prompt_runs
  WHERE prompt_runs.id = finalize_prompt_run.prompt_run_id;

  SELECT
    COUNT(*) FILTER (WHERE prompt_run_responses.status = 'completed'),
    COUNT(*) FILTER (WHERE prompt_run_responses.status <> 'completed')
  INTO completed_count, failed_count
  FROM prompt_run_responses
  WHERE prompt_run_responses.prompt_run_id = finalize_prompt_run.prompt_run_id;

  next_status = CASE
    WHEN completed_count = 3 THEN 'completed'
    WHEN completed_count > 0 THEN 'partial'
    ELSE 'failed'
  END;

  SELECT prompt_run_responses.error_message
  INTO failure_message
  FROM prompt_run_responses
  WHERE prompt_run_responses.prompt_run_id = finalize_prompt_run.prompt_run_id
    AND prompt_run_responses.error_message IS NOT NULL
  ORDER BY prompt_run_responses.created_at DESC
  LIMIT 1;

  UPDATE prompt_runs
  SET status = next_status,
      completed_at = NOW(),
      failure_reason = CASE WHEN next_status = 'completed' THEN NULL ELSE failure_message END
  WHERE prompt_runs.id = finalize_prompt_run.prompt_run_id;

  UPDATE tracked_prompts
  SET last_run_at = NOW(),
      last_run_status = next_status,
      last_failure_message = CASE WHEN next_status = 'completed' THEN NULL ELSE failure_message END,
      last_chat_prompt_run_id = finalize_prompt_run.prompt_run_id
  WHERE tracked_prompts.id = prompt_run_row.tracked_prompt_id;
END;
$$;

CREATE OR REPLACE FUNCTION finalize_prompt_pipeline_run(
  pipeline_run_id UUID,
  status TEXT,
  failure_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pipeline_run_row prompt_pipeline_runs%ROWTYPE;
  completed_count INTEGER;
  partial_count INTEGER;
  failed_count INTEGER;
  resolved_status TEXT;
BEGIN
  SELECT *
  INTO pipeline_run_row
  FROM prompt_pipeline_runs
  WHERE prompt_pipeline_runs.id = finalize_prompt_pipeline_run.pipeline_run_id;

  SELECT
    COUNT(*) FILTER (WHERE prompt_runs.status = 'completed'),
    COUNT(*) FILTER (WHERE prompt_runs.status = 'partial'),
    COUNT(*) FILTER (WHERE prompt_runs.status = 'failed')
  INTO completed_count, partial_count, failed_count
  FROM prompt_runs
  WHERE prompt_runs.pipeline_run_id = finalize_prompt_pipeline_run.pipeline_run_id;

  resolved_status = CASE
    WHEN finalize_prompt_pipeline_run.status = 'failed' THEN 'failed'
    WHEN failed_count > 0 OR partial_count > 0 THEN 'partial'
    ELSE 'completed'
  END;

  UPDATE prompt_pipeline_runs
  SET status = resolved_status,
      failure_reason = CASE WHEN resolved_status = 'completed' THEN NULL ELSE finalize_prompt_pipeline_run.failure_reason END,
      prompt_count_completed = completed_count,
      prompt_count_partial = partial_count,
      prompt_count_failed = failed_count
  WHERE prompt_pipeline_runs.id = finalize_prompt_pipeline_run.pipeline_run_id;

  UPDATE prompt_pipeline_configs
  SET last_run_at = NOW(),
      last_run_status = resolved_status,
      last_failure_message = CASE WHEN resolved_status = 'completed' THEN NULL ELSE finalize_prompt_pipeline_run.failure_reason END,
      last_pipeline_run_id = finalize_prompt_pipeline_run.pipeline_run_id
  WHERE prompt_pipeline_configs.id = pipeline_run_row.config_id;
END;
$$;
