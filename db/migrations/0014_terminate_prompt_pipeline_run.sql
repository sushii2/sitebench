CREATE OR REPLACE FUNCTION terminate_prompt_pipeline_run(pipeline_run_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pipeline_run_row prompt_pipeline_runs%ROWTYPE;
BEGIN
  SELECT prompt_pipeline_runs.*
  INTO pipeline_run_row
  FROM prompt_pipeline_runs
  JOIN tracking_projects
    ON tracking_projects.id = prompt_pipeline_runs.project_id
  WHERE prompt_pipeline_runs.id = terminate_prompt_pipeline_run.pipeline_run_id
    AND tracking_projects.user_id = auth.uid();

  IF pipeline_run_row.id IS NULL THEN
    RETURN;
  END IF;

  IF pipeline_run_row.status NOT IN ('queued', 'running') THEN
    RETURN;
  END IF;

  UPDATE tracked_prompts
  SET last_run_at = NULL,
      last_run_status = NULL,
      last_failure_message = NULL,
      last_chat_prompt_run_id = NULL
  WHERE tracked_prompts.last_chat_prompt_run_id IN (
    SELECT prompt_runs.id
    FROM prompt_runs
    WHERE prompt_runs.pipeline_run_id = terminate_prompt_pipeline_run.pipeline_run_id
  );

  UPDATE prompt_pipeline_configs
  SET last_run_at = NULL,
      last_run_status = NULL,
      last_failure_message = NULL,
      last_pipeline_run_id = NULL,
      updated_at = NOW()
  WHERE prompt_pipeline_configs.id = pipeline_run_row.config_id
    AND (
      prompt_pipeline_configs.last_pipeline_run_id = terminate_prompt_pipeline_run.pipeline_run_id
      OR prompt_pipeline_configs.last_run_status IN ('queued', 'running')
    );

  DELETE FROM prompt_runs
  WHERE prompt_runs.pipeline_run_id = terminate_prompt_pipeline_run.pipeline_run_id;

  DELETE FROM prompt_pipeline_runs
  WHERE prompt_pipeline_runs.id = terminate_prompt_pipeline_run.pipeline_run_id;
END;
$$;
