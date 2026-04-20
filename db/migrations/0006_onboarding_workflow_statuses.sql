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
      'seeding',
      'enhancing',
      'competitors',
      'prompting',
      'completed',
      'failed'
    )
  );
