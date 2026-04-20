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
  WHERE prompt_pipeline_runs.id = begin_prompt_pipeline_run.pipeline_run_id;

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
      begin_prompt_pipeline_run.pipeline_run_id,
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
      begin_prompt_pipeline_run.pipeline_run_id,
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
    SET workflow_run_id = COALESCE(
      begin_prompt_pipeline_run.workflow_run_id,
      prompt_pipeline_runs.workflow_run_id
    )
    WHERE prompt_pipeline_runs.id = begin_prompt_pipeline_run.pipeline_run_id;
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
    WHERE run_row.id = begin_prompt_pipeline_run.pipeline_run_id
    GROUP BY run_row.id
  );
END;
$$;
