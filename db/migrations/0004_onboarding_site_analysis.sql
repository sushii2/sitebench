CREATE TABLE site_crawl_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL DEFAULT 'onboarding'
    CHECK (trigger_type IN ('onboarding')),
  status TEXT NOT NULL DEFAULT 'mapping'
    CHECK (status IN ('mapping', 'crawling', 'extracting', 'clustering', 'prompting', 'scoring', 'completed', 'failed')),
  firecrawl_job_ids TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  selected_url_count INTEGER NOT NULL DEFAULT 0,
  warnings TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  result_json JSONB NULL,
  error_message TEXT NULL,
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE site_crawl_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_run_id UUID NOT NULL REFERENCES site_crawl_runs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
  canonical_url TEXT NOT NULL,
  page_type TEXT NOT NULL
    CHECK (page_type IN ('homepage', 'product', 'pricing', 'comparison', 'blog', 'excluded')),
  selection_score INTEGER NOT NULL DEFAULT 0,
  selection_reason TEXT NOT NULL,
  title TEXT NULL,
  meta_description TEXT NULL,
  content_snapshot TEXT NOT NULL,
  entities_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  intents_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  competitor_candidates_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  page_metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (crawl_run_id, canonical_url)
);

ALTER TABLE tracked_prompts
  ADD COLUMN IF NOT EXISTS variant_type TEXT NULL
    CHECK (variant_type IN ('discovery', 'comparison', 'alternatives', 'pricing', 'implementation', 'use_case', 'migration', 'roi', 'integration', 'competitor_specific')),
  ADD COLUMN IF NOT EXISTS pqs_score NUMERIC(5, 2) NULL
    CHECK (pqs_score >= 0 AND pqs_score <= 100),
  ADD COLUMN IF NOT EXISTS pqs_rank INTEGER NULL
    CHECK (pqs_rank > 0),
  ADD COLUMN IF NOT EXISTS score_status TEXT NOT NULL DEFAULT 'unscored'
    CHECK (score_status IN ('scored', 'stale', 'unscored')),
  ADD COLUMN IF NOT EXISTS score_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_analysis_run_id UUID NULL REFERENCES site_crawl_runs(id) ON DELETE SET NULL;

CREATE INDEX site_crawl_runs_project_id_idx ON site_crawl_runs (project_id);
CREATE INDEX site_crawl_runs_status_idx ON site_crawl_runs (status);
CREATE INDEX site_crawl_pages_run_id_idx ON site_crawl_pages (crawl_run_id);
CREATE INDEX site_crawl_pages_project_id_idx ON site_crawl_pages (project_id);
CREATE INDEX site_crawl_pages_type_idx ON site_crawl_pages (page_type);
CREATE INDEX tracked_prompts_source_analysis_run_idx ON tracked_prompts (source_analysis_run_id);

ALTER TABLE site_crawl_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_crawl_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_crawl_runs_select_own" ON site_crawl_runs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = site_crawl_runs.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "site_crawl_runs_insert_own" ON site_crawl_runs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = site_crawl_runs.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "site_crawl_runs_update_own" ON site_crawl_runs
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = site_crawl_runs.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = site_crawl_runs.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "site_crawl_runs_delete_own" ON site_crawl_runs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = site_crawl_runs.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "site_crawl_pages_select_own" ON site_crawl_pages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = site_crawl_pages.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "site_crawl_pages_insert_own" ON site_crawl_pages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = site_crawl_pages.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "site_crawl_pages_update_own" ON site_crawl_pages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = site_crawl_pages.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = site_crawl_pages.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "site_crawl_pages_delete_own" ON site_crawl_pages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = site_crawl_pages.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE TRIGGER site_crawl_runs_updated_at
  BEFORE UPDATE ON site_crawl_runs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER site_crawl_pages_updated_at
  BEFORE UPDATE ON site_crawl_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
