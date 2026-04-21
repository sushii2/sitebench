INSERT INTO ai_platforms (code, label, sort_order)
VALUES ('perplexity', 'Perplexity', 4)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE prompt_runs
  DROP CONSTRAINT IF EXISTS prompt_runs_cadence_applied_check;

ALTER TABLE prompt_runs
  ADD CONSTRAINT prompt_runs_cadence_applied_check
    CHECK (
      cadence_applied IN (
        'daily',
        'every_2_days',
        'every_3_days',
        'weekly',
        'manual'
      )
    );

CREATE TABLE prompt_run_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES tracking_projects(id) ON DELETE CASCADE,
  cadence_days SMALLINT NOT NULL CHECK (cadence_days IN (1, 2, 3, 7)),
  scheduled_run_local_time TEXT NOT NULL DEFAULT '09:00',
  enabled_providers TEXT[] NOT NULL CHECK (
    cardinality(enabled_providers) > 0
    AND enabled_providers <@ ARRAY['chatgpt', 'claude', 'perplexity']::text[]
  ),
  selected_tracked_prompt_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  selected_project_topic_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ NULL,
  next_run_at TIMESTAMPTZ NULL,
  claimed_at TIMESTAMPTZ NULL,
  current_run_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX prompt_run_configs_due_idx
  ON prompt_run_configs (next_run_at)
  WHERE is_enabled;

ALTER TABLE prompt_run_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prompt_run_configs_select_own" ON prompt_run_configs
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = prompt_run_configs.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "prompt_run_configs_insert_own" ON prompt_run_configs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = prompt_run_configs.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "prompt_run_configs_update_own" ON prompt_run_configs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = prompt_run_configs.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = prompt_run_configs.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "prompt_run_configs_delete_own" ON prompt_run_configs
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = prompt_run_configs.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );

CREATE TRIGGER prompt_run_configs_updated_at
  BEFORE UPDATE ON prompt_run_configs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE brand_entities
  ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT 'user'
    CHECK (created_by IN ('user', 'onboarding', 'ai_discovered'));
