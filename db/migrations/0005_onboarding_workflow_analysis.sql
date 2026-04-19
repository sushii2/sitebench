ALTER TABLE site_crawl_runs
  ADD COLUMN IF NOT EXISTS analysis_version INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS workflow_run_id TEXT NULL;

ALTER TABLE site_crawl_runs
  DROP CONSTRAINT IF EXISTS site_crawl_runs_status_check;

ALTER TABLE site_crawl_runs
  ADD CONSTRAINT site_crawl_runs_status_check
  CHECK (
    status IN (
      'mapping',
      'classifying',
      'planning',
      'scraping',
      'profiling',
      'competitors',
      'prompting',
      'completed',
      'failed'
    )
  );

ALTER TABLE site_crawl_pages
  DROP CONSTRAINT IF EXISTS site_crawl_pages_page_type_check;

ALTER TABLE site_crawl_pages
  ADD CONSTRAINT site_crawl_pages_page_type_check
  CHECK (
    page_type IN (
      'homepage',
      'product_hub',
      'pricing',
      'category_hub',
      'solution_page',
      'integration_page',
      'proof_page',
      'comparison_page',
      'geography_page',
      'careers_page',
      'editorial_page',
      'other'
    )
  );

CREATE TABLE IF NOT EXISTS site_crawl_mapped_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  crawl_run_id UUID NOT NULL REFERENCES site_crawl_runs(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
  canonical_url TEXT NOT NULL,
  candidate_bucket TEXT NOT NULL
    CHECK (
      candidate_bucket IN (
        'homepage',
        'pricing',
        'product_hub',
        'category_hub',
        'solution_page',
        'integration_page',
        'comparison_page',
        'proof_page',
        'about',
        'careers',
        'editorial',
        'geography',
        'product_detail',
        'utility'
      )
    ),
  candidate_reason TEXT NOT NULL,
  candidate_score INTEGER NOT NULL DEFAULT 0,
  title TEXT NULL,
  meta_description TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (crawl_run_id, canonical_url)
);

CREATE INDEX IF NOT EXISTS site_crawl_runs_workflow_run_id_idx
  ON site_crawl_runs (workflow_run_id);
CREATE INDEX IF NOT EXISTS site_crawl_mapped_pages_run_id_idx
  ON site_crawl_mapped_pages (crawl_run_id);
CREATE INDEX IF NOT EXISTS site_crawl_mapped_pages_project_id_idx
  ON site_crawl_mapped_pages (project_id);
CREATE INDEX IF NOT EXISTS site_crawl_mapped_pages_bucket_idx
  ON site_crawl_mapped_pages (candidate_bucket);

ALTER TABLE site_crawl_mapped_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_crawl_mapped_pages_select_own" ON site_crawl_mapped_pages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = site_crawl_mapped_pages.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "site_crawl_mapped_pages_insert_own" ON site_crawl_mapped_pages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = site_crawl_mapped_pages.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "site_crawl_mapped_pages_update_own" ON site_crawl_mapped_pages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = site_crawl_mapped_pages.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = site_crawl_mapped_pages.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "site_crawl_mapped_pages_delete_own" ON site_crawl_mapped_pages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = site_crawl_mapped_pages.project_id
        AND tracking_projects.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS site_crawl_mapped_pages_updated_at ON site_crawl_mapped_pages;

CREATE TRIGGER site_crawl_mapped_pages_updated_at
  BEFORE UPDATE ON site_crawl_mapped_pages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
