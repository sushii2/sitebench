CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE tracking_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  market_category TEXT NULL,
  reporting_timezone TEXT NOT NULL DEFAULT 'UTC',
  onboarding_status TEXT NOT NULL DEFAULT 'draft'
    CHECK (onboarding_status IN ('draft', 'complete')),
  onboarding_completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE brand_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('primary', 'competitor')),
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  website_url TEXT NOT NULL,
  website_host TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, normalized_name),
  UNIQUE (project_id, website_host)
);

CREATE UNIQUE INDEX brand_entities_one_primary_per_project_idx
  ON brand_entities (project_id)
  WHERE role = 'primary';

CREATE TABLE topic_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL UNIQUE,
  category_label TEXT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE project_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
  topic_catalog_id UUID NULL REFERENCES topic_catalog(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  default_cadence TEXT NOT NULL DEFAULT 'weekly'
    CHECK (default_cadence IN ('daily', 'weekly', 'monthly')),
  source TEXT NOT NULL DEFAULT 'user_added'
    CHECK (source IN ('user_added', 'ai_suggested', 'system_seeded')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, normalized_name)
);

CREATE TABLE prompt_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_catalog_id UUID NULL REFERENCES topic_catalog(id) ON DELETE SET NULL,
  prompt_text TEXT NOT NULL,
  normalized_prompt TEXT NOT NULL UNIQUE,
  intent TEXT NULL,
  source TEXT NOT NULL DEFAULT 'researched'
    CHECK (source IN ('seeded', 'researched', 'user_promoted')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ai_platforms (
  code TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE prompt_market_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_catalog_id UUID NOT NULL REFERENCES prompt_catalog(id) ON DELETE CASCADE,
  platform_code TEXT NOT NULL REFERENCES ai_platforms(code),
  observed_on DATE NOT NULL,
  estimated_volume INTEGER NULL,
  trend_score NUMERIC(6, 2) NULL,
  trend_delta NUMERIC(6, 2) NULL,
  source_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (prompt_catalog_id, platform_code, observed_on)
);

CREATE TABLE project_platforms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
  platform_code TEXT NOT NULL REFERENCES ai_platforms(code),
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, platform_code)
);

CREATE TABLE tracked_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
  project_topic_id UUID NOT NULL REFERENCES project_topics(id) ON DELETE CASCADE,
  prompt_catalog_id UUID NULL REFERENCES prompt_catalog(id) ON DELETE SET NULL,
  prompt_text TEXT NOT NULL,
  normalized_prompt TEXT NOT NULL,
  cadence_override TEXT NULL
    CHECK (cadence_override IN ('daily', 'weekly', 'monthly')),
  added_via TEXT NOT NULL
    CHECK (added_via IN ('user_selected', 'user_created', 'ai_suggested', 'system_seeded')),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  next_run_at TIMESTAMPTZ NULL,
  last_run_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_topic_id, normalized_prompt)
);

CREATE TABLE prompt_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
  project_topic_id UUID NOT NULL REFERENCES project_topics(id) ON DELETE CASCADE,
  tracked_prompt_id UUID NOT NULL REFERENCES tracked_prompts(id) ON DELETE CASCADE,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('scheduled', 'manual', 'backfill')),
  cadence_applied TEXT NOT NULL CHECK (cadence_applied IN ('daily', 'weekly', 'monthly', 'manual')),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'partial', 'failed')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  failure_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE prompt_run_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
  prompt_run_id UUID NOT NULL REFERENCES prompt_runs(id) ON DELETE CASCADE,
  platform_code TEXT NOT NULL REFERENCES ai_platforms(code),
  provider_model TEXT NULL,
  prompt_text TEXT NOT NULL,
  raw_response_text TEXT NULL,
  raw_response_json JSONB NULL,
  parser_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('completed', 'failed', 'timeout', 'blocked', 'rate_limited')),
  latency_ms INTEGER NULL,
  input_tokens INTEGER NULL,
  output_tokens INTEGER NULL,
  error_code TEXT NULL,
  error_message TEXT NULL,
  responded_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (prompt_run_id, platform_code)
);

CREATE TABLE response_brand_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
  response_id UUID NOT NULL REFERENCES prompt_run_responses(id) ON DELETE CASCADE,
  brand_entity_id UUID NOT NULL REFERENCES brand_entities(id) ON DELETE CASCADE,
  rank_position INTEGER NULL,
  mention_count INTEGER NOT NULL DEFAULT 1,
  visibility_score NUMERIC(6, 2) NOT NULL,
  recommendation_status TEXT NOT NULL
    CHECK (recommendation_status IN ('recommended', 'mentioned', 'not_recommended')),
  sentiment_label TEXT NOT NULL
    CHECK (sentiment_label IN ('positive', 'neutral', 'negative', 'mixed')),
  sentiment_score NUMERIC(6, 2) NULL,
  citation_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (response_id, brand_entity_id)
);

CREATE TABLE source_domains (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain TEXT NOT NULL UNIQUE,
  root_domain TEXT NOT NULL,
  display_name TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE source_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_id UUID NOT NULL REFERENCES source_domains(id) ON DELETE CASCADE,
  canonical_url TEXT NOT NULL UNIQUE,
  page_title TEXT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE response_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
  response_id UUID NOT NULL REFERENCES prompt_run_responses(id) ON DELETE CASCADE,
  source_page_id UUID NOT NULL REFERENCES source_pages(id) ON DELETE CASCADE,
  citation_order INTEGER NULL,
  cited_url TEXT NOT NULL,
  citation_text TEXT NULL,
  authority_score NUMERIC(6, 2) NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE response_brand_citations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES tracking_projects(id) ON DELETE CASCADE,
  response_brand_metric_id UUID NOT NULL REFERENCES response_brand_metrics(id) ON DELETE CASCADE,
  response_citation_id UUID NOT NULL REFERENCES response_citations(id) ON DELETE CASCADE,
  attribution_score NUMERIC(6, 2) NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (response_brand_metric_id, response_citation_id)
);

CREATE INDEX brand_entities_project_id_idx ON brand_entities (project_id);
CREATE INDEX brand_entities_project_role_idx ON brand_entities (project_id, role);
CREATE INDEX project_topics_project_id_idx ON project_topics (project_id);
CREATE INDEX tracked_prompts_project_id_idx ON tracked_prompts (project_id);
CREATE INDEX tracked_prompts_topic_id_idx ON tracked_prompts (project_topic_id);
CREATE INDEX prompt_runs_project_id_idx ON prompt_runs (project_id);
CREATE INDEX prompt_runs_tracked_prompt_id_idx ON prompt_runs (tracked_prompt_id);
CREATE INDEX prompt_run_responses_project_id_idx ON prompt_run_responses (project_id);
CREATE INDEX prompt_run_responses_prompt_run_id_idx ON prompt_run_responses (prompt_run_id);
CREATE INDEX response_brand_metrics_project_id_idx ON response_brand_metrics (project_id);
CREATE INDEX response_brand_metrics_response_id_idx ON response_brand_metrics (response_id);
CREATE INDEX response_brand_metrics_brand_id_idx ON response_brand_metrics (brand_entity_id);
CREATE INDEX response_citations_project_id_idx ON response_citations (project_id);
CREATE INDEX response_citations_response_id_idx ON response_citations (response_id);
CREATE INDEX response_brand_citations_project_id_idx ON response_brand_citations (project_id);
CREATE INDEX prompt_market_metrics_prompt_id_idx ON prompt_market_metrics (prompt_catalog_id);
CREATE INDEX project_platforms_project_id_idx ON project_platforms (project_id);
CREATE INDEX source_pages_domain_id_idx ON source_pages (domain_id);

INSERT INTO ai_platforms (code, label, sort_order)
VALUES
  ('chatgpt', 'ChatGPT', 0),
  ('claude', 'Claude', 1),
  ('gemini', 'Gemini', 2),
  ('grok', 'Grok', 3)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE tracking_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_market_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_platforms ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracked_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_run_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_brand_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_brand_citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tracking_projects_select_own" ON tracking_projects
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "tracking_projects_insert_own" ON tracking_projects
  FOR INSERT WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "tracking_projects_update_own" ON tracking_projects
  FOR UPDATE USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY "tracking_projects_delete_own" ON tracking_projects
  FOR DELETE USING (user_id = (SELECT auth.uid()));

CREATE POLICY "brand_entities_select_own" ON brand_entities
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = brand_entities.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "brand_entities_insert_own" ON brand_entities
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = brand_entities.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "brand_entities_update_own" ON brand_entities
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = brand_entities.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = brand_entities.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "brand_entities_delete_own" ON brand_entities
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = brand_entities.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "project_topics_select_own" ON project_topics
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = project_topics.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "project_topics_insert_own" ON project_topics
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = project_topics.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "project_topics_update_own" ON project_topics
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = project_topics.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = project_topics.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "project_topics_delete_own" ON project_topics
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = project_topics.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "project_platforms_select_own" ON project_platforms
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = project_platforms.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "project_platforms_insert_own" ON project_platforms
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = project_platforms.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "project_platforms_update_own" ON project_platforms
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = project_platforms.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = project_platforms.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "project_platforms_delete_own" ON project_platforms
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = project_platforms.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "tracked_prompts_select_own" ON tracked_prompts
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = tracked_prompts.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "tracked_prompts_insert_own" ON tracked_prompts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = tracked_prompts.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "tracked_prompts_update_own" ON tracked_prompts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = tracked_prompts.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = tracked_prompts.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );
CREATE POLICY "tracked_prompts_delete_own" ON tracked_prompts
  FOR DELETE USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = tracked_prompts.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "prompt_runs_select_own" ON prompt_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = prompt_runs.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "prompt_run_responses_select_own" ON prompt_run_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = prompt_run_responses.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "response_brand_metrics_select_own" ON response_brand_metrics
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = response_brand_metrics.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "response_citations_select_own" ON response_citations
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = response_citations.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "response_brand_citations_select_own" ON response_brand_citations
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM tracking_projects
      WHERE tracking_projects.id = response_brand_citations.project_id
        AND tracking_projects.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "topic_catalog_select_authenticated" ON topic_catalog
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "prompt_catalog_select_authenticated" ON prompt_catalog
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "ai_platforms_select_authenticated" ON ai_platforms
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

CREATE POLICY "prompt_market_metrics_select_authenticated" ON prompt_market_metrics
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

CREATE TRIGGER tracking_projects_updated_at
  BEFORE UPDATE ON tracking_projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER brand_entities_updated_at
  BEFORE UPDATE ON brand_entities
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER topic_catalog_updated_at
  BEFORE UPDATE ON topic_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER project_topics_updated_at
  BEFORE UPDATE ON project_topics
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER prompt_catalog_updated_at
  BEFORE UPDATE ON prompt_catalog
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER ai_platforms_updated_at
  BEFORE UPDATE ON ai_platforms
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER project_platforms_updated_at
  BEFORE UPDATE ON project_platforms
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER tracked_prompts_updated_at
  BEFORE UPDATE ON tracked_prompts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE VIEW vw_dashboard_kpis AS
SELECT
  rbm.project_id,
  COUNT(*) FILTER (WHERE be.role = 'primary') AS primary_brand_mentions,
  AVG(rbm.visibility_score) FILTER (WHERE be.role = 'primary') AS avg_primary_visibility_score,
  AVG(rbm.citation_score) FILTER (WHERE be.role = 'primary') AS avg_primary_citation_score,
  AVG(rbm.sentiment_score) FILTER (WHERE be.role = 'primary') AS avg_primary_sentiment_score
FROM response_brand_metrics rbm
JOIN brand_entities be ON be.id = rbm.brand_entity_id
GROUP BY rbm.project_id;

CREATE OR REPLACE VIEW vw_visibility_trends AS
SELECT
  rbm.project_id,
  DATE_TRUNC('day', COALESCE(prr.responded_at, prr.created_at))::date AS bucket_date,
  rbm.brand_entity_id,
  AVG(rbm.visibility_score) AS avg_visibility_score,
  AVG(rbm.rank_position) AS avg_rank_position
FROM response_brand_metrics rbm
JOIN prompt_run_responses prr ON prr.id = rbm.response_id
GROUP BY rbm.project_id, bucket_date, rbm.brand_entity_id;

CREATE OR REPLACE VIEW vw_provider_rankings AS
SELECT
  rbm.project_id,
  prr.platform_code,
  pr.project_topic_id,
  rbm.brand_entity_id,
  AVG(rbm.rank_position) AS avg_rank_position,
  AVG(rbm.visibility_score) AS avg_visibility_score,
  AVG(rbm.citation_score) AS avg_citation_score,
  AVG(rbm.sentiment_score) AS avg_sentiment_score
FROM response_brand_metrics rbm
JOIN prompt_run_responses prr ON prr.id = rbm.response_id
JOIN prompt_runs pr ON pr.id = prr.prompt_run_id
GROUP BY rbm.project_id, prr.platform_code, pr.project_topic_id, rbm.brand_entity_id;

CREATE OR REPLACE VIEW vw_topic_leaderboard AS
SELECT
  pr.project_id,
  pr.project_topic_id,
  rbm.brand_entity_id,
  AVG(rbm.rank_position) AS avg_rank_position,
  AVG(rbm.visibility_score) AS avg_visibility_score,
  RANK() OVER (
    PARTITION BY pr.project_id, pr.project_topic_id
    ORDER BY AVG(rbm.visibility_score) DESC, AVG(rbm.rank_position) ASC NULLS LAST
  ) AS leaderboard_position
FROM response_brand_metrics rbm
JOIN prompt_run_responses prr ON prr.id = rbm.response_id
JOIN prompt_runs pr ON pr.id = prr.prompt_run_id
GROUP BY pr.project_id, pr.project_topic_id, rbm.brand_entity_id;

CREATE OR REPLACE VIEW vw_content_gap_prompts AS
SELECT
  pr.project_id,
  pr.project_topic_id,
  pr.tracked_prompt_id,
  COUNT(*) FILTER (WHERE be.role = 'competitor') AS competitor_mentions,
  COUNT(*) FILTER (WHERE be.role = 'primary') AS primary_brand_mentions
FROM response_brand_metrics rbm
JOIN brand_entities be ON be.id = rbm.brand_entity_id
JOIN prompt_run_responses prr ON prr.id = rbm.response_id
JOIN prompt_runs pr ON pr.id = prr.prompt_run_id
GROUP BY pr.project_id, pr.project_topic_id, pr.tracked_prompt_id
HAVING COUNT(*) FILTER (WHERE be.role = 'competitor') > 0
   AND COUNT(*) FILTER (WHERE be.role = 'primary') = 0;

CREATE OR REPLACE VIEW vw_citation_sources AS
SELECT
  rc.project_id,
  rbm.brand_entity_id,
  sd.domain,
  COUNT(*) AS citation_count,
  AVG(COALESCE(rc.authority_score, 0)) AS avg_authority_score,
  AVG(rbc.attribution_score) AS avg_attribution_score
FROM response_citations rc
JOIN source_pages sp ON sp.id = rc.source_page_id
JOIN source_domains sd ON sd.id = sp.domain_id
JOIN response_brand_citations rbc ON rbc.response_citation_id = rc.id
JOIN response_brand_metrics rbm ON rbm.id = rbc.response_brand_metric_id
GROUP BY rc.project_id, rbm.brand_entity_id, sd.domain;

CREATE OR REPLACE VIEW vw_weekly_rank_deltas AS
WITH weekly_ranks AS (
  SELECT
    rbm.project_id,
    rbm.brand_entity_id,
    DATE_TRUNC('week', COALESCE(prr.responded_at, prr.created_at))::date AS week_start,
    AVG(rbm.rank_position) AS avg_rank_position
  FROM response_brand_metrics rbm
  JOIN prompt_run_responses prr ON prr.id = rbm.response_id
  GROUP BY rbm.project_id, rbm.brand_entity_id, week_start
)
SELECT
  project_id,
  brand_entity_id,
  week_start,
  avg_rank_position,
  avg_rank_position - LAG(avg_rank_position) OVER (
    PARTITION BY project_id, brand_entity_id
    ORDER BY week_start
  ) AS rank_delta
FROM weekly_ranks;
