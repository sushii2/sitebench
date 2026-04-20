ALTER TABLE prompt_pipeline_configs
  DROP CONSTRAINT IF EXISTS prompt_pipeline_configs_last_run_status_check;

ALTER TABLE prompt_pipeline_configs
  ADD CONSTRAINT prompt_pipeline_configs_last_run_status_check
  CHECK (
    last_run_status IS NULL
    OR last_run_status IN (
      'queued',
      'running',
      'completed',
      'partial',
      'failed',
      'cancelled'
    )
  );

ALTER TABLE prompt_pipeline_runs
  DROP CONSTRAINT IF EXISTS prompt_pipeline_runs_status_check;

ALTER TABLE prompt_pipeline_runs
  ADD CONSTRAINT prompt_pipeline_runs_status_check
  CHECK (
    status IN (
      'queued',
      'running',
      'completed',
      'partial',
      'failed',
      'cancelled'
    )
  );

ALTER TABLE tracked_prompts
  DROP CONSTRAINT IF EXISTS tracked_prompts_last_run_status_check;

ALTER TABLE tracked_prompts
  ADD CONSTRAINT tracked_prompts_last_run_status_check
  CHECK (
    last_run_status IS NULL
    OR last_run_status IN (
      'queued',
      'running',
      'completed',
      'partial',
      'failed',
      'cancelled'
    )
  );

ALTER TABLE prompt_runs
  DROP CONSTRAINT IF EXISTS prompt_runs_status_check;

ALTER TABLE prompt_runs
  ADD CONSTRAINT prompt_runs_status_check
  CHECK (
    status IN (
      'queued',
      'running',
      'completed',
      'partial',
      'failed',
      'cancelled'
    )
  );

CREATE TABLE prompt_pipeline_run_traces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
  pipeline_run_id UUID NOT NULL REFERENCES prompt_pipeline_runs(id) ON DELETE CASCADE,
  step_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK (
    status IN ('running', 'completed', 'failed', 'cancelled')
  ),
  message TEXT NOT NULL,
  detail_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE prompt_pipeline_run_traces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt_pipeline_run_traces_select_own" ON prompt_pipeline_run_traces
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = prompt_pipeline_run_traces.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE INDEX prompt_pipeline_run_traces_pipeline_run_id_created_at_idx
  ON prompt_pipeline_run_traces (pipeline_run_id, created_at ASC);

CREATE OR REPLACE FUNCTION record_prompt_pipeline_run_trace(
  pipeline_run_id UUID,
  step_key TEXT,
  status TEXT,
  message TEXT,
  detail_json JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pipeline_run_row prompt_pipeline_runs%ROWTYPE;
BEGIN
  SELECT *
  INTO pipeline_run_row
  FROM prompt_pipeline_runs
  WHERE prompt_pipeline_runs.id = record_prompt_pipeline_run_trace.pipeline_run_id;

  IF pipeline_run_row.id IS NULL THEN
    RAISE EXCEPTION 'Prompt pipeline run % not found.', record_prompt_pipeline_run_trace.pipeline_run_id;
  END IF;

  INSERT INTO prompt_pipeline_run_traces (
    project_id,
    pipeline_run_id,
    step_key,
    status,
    message,
    detail_json
  )
  VALUES (
    pipeline_run_row.project_id,
    pipeline_run_row.id,
    record_prompt_pipeline_run_trace.step_key,
    record_prompt_pipeline_run_trace.status,
    record_prompt_pipeline_run_trace.message,
    COALESCE(record_prompt_pipeline_run_trace.detail_json, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION cancel_prompt_pipeline_run(
  pipeline_run_id UUID,
  failure_reason TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pipeline_run_row prompt_pipeline_runs%ROWTYPE;
  prompt_run_row RECORD;
  completed_count INTEGER;
  partial_count INTEGER;
  failed_count INTEGER;
  resolved_failure_reason TEXT;
BEGIN
  SELECT *
  INTO pipeline_run_row
  FROM prompt_pipeline_runs
  WHERE prompt_pipeline_runs.id = cancel_prompt_pipeline_run.pipeline_run_id;

  IF pipeline_run_row.id IS NULL THEN
    RETURN;
  END IF;

  IF pipeline_run_row.status NOT IN ('queued', 'running') THEN
    RETURN;
  END IF;

  resolved_failure_reason = COALESCE(
    cancel_prompt_pipeline_run.failure_reason,
    'Workflow was stopped before completion.'
  );

  UPDATE prompt_runs
  SET status = 'cancelled',
      completed_at = COALESCE(prompt_runs.completed_at, NOW()),
      failure_reason = COALESCE(prompt_runs.failure_reason, resolved_failure_reason)
  WHERE prompt_runs.pipeline_run_id = cancel_prompt_pipeline_run.pipeline_run_id
    AND prompt_runs.status IN ('queued', 'running');

  FOR prompt_run_row IN
    SELECT prompt_runs.id, prompt_runs.tracked_prompt_id
    FROM prompt_runs
    WHERE prompt_runs.pipeline_run_id = cancel_prompt_pipeline_run.pipeline_run_id
      AND prompt_runs.status = 'cancelled'
  LOOP
    UPDATE tracked_prompts
    SET last_run_at = NOW(),
        last_run_status = 'cancelled',
        last_failure_message = resolved_failure_reason,
        last_chat_prompt_run_id = prompt_run_row.id
    WHERE tracked_prompts.id = prompt_run_row.tracked_prompt_id;
  END LOOP;

  SELECT
    COUNT(*) FILTER (WHERE prompt_runs.status = 'completed'),
    COUNT(*) FILTER (WHERE prompt_runs.status = 'partial'),
    COUNT(*) FILTER (WHERE prompt_runs.status = 'failed')
  INTO completed_count, partial_count, failed_count
  FROM prompt_runs
  WHERE prompt_runs.pipeline_run_id = cancel_prompt_pipeline_run.pipeline_run_id;

  UPDATE prompt_pipeline_runs
  SET status = 'cancelled',
      failure_reason = resolved_failure_reason,
      prompt_count_completed = completed_count,
      prompt_count_partial = partial_count,
      prompt_count_failed = failed_count,
      updated_at = NOW()
  WHERE prompt_pipeline_runs.id = cancel_prompt_pipeline_run.pipeline_run_id;

  UPDATE prompt_pipeline_configs
  SET last_run_at = NOW(),
      last_run_status = 'cancelled',
      last_failure_message = resolved_failure_reason,
      last_pipeline_run_id = cancel_prompt_pipeline_run.pipeline_run_id,
      updated_at = NOW()
  WHERE prompt_pipeline_configs.id = pipeline_run_row.config_id;

  PERFORM record_prompt_pipeline_run_trace(
    cancel_prompt_pipeline_run.pipeline_run_id,
    'workflow_cancelled',
    'cancelled',
    resolved_failure_reason,
    jsonb_build_object('source', 'workflow_reconciliation')
  );
END;
$$;
