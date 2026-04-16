WITH upserted_projects AS (
  INSERT INTO tracking_projects (
    id,
    user_id,
    market_category,
    reporting_timezone,
    onboarding_status,
    onboarding_completed_at,
    created_at,
    updated_at
  )
  SELECT
    b.id,
    b.user_id,
    NULL,
    'UTC',
    CASE
      WHEN b.onboarding_completed_at IS NULL THEN 'draft'
      ELSE 'complete'
    END,
    b.onboarding_completed_at,
    b.created_at,
    b.updated_at
  FROM brands b
  ON CONFLICT (id) DO UPDATE
  SET
    user_id = EXCLUDED.user_id,
    onboarding_status = EXCLUDED.onboarding_status,
    onboarding_completed_at = EXCLUDED.onboarding_completed_at,
    updated_at = GREATEST(tracking_projects.updated_at, EXCLUDED.updated_at)
  RETURNING id
)
INSERT INTO brand_entities (
  id,
  project_id,
  role,
  name,
  normalized_name,
  website_url,
  website_host,
  description,
  sort_order,
  is_active,
  created_at,
  updated_at
)
SELECT
  b.id,
  b.id,
  'primary',
  b.company_name,
  lower(trim(regexp_replace(b.company_name, '\s+', ' ', 'g'))),
  b.website,
  lower(regexp_replace(regexp_replace(b.website, '^https?://', ''), '/.*$', '')),
  b.description,
  0,
  TRUE,
  b.created_at,
  b.updated_at
FROM brands b
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  normalized_name = EXCLUDED.normalized_name,
  website_url = EXCLUDED.website_url,
  website_host = EXCLUDED.website_host,
  description = EXCLUDED.description,
  updated_at = GREATEST(brand_entities.updated_at, EXCLUDED.updated_at);

INSERT INTO brand_entities (
  id,
  project_id,
  role,
  name,
  normalized_name,
  website_url,
  website_host,
  description,
  sort_order,
  is_active,
  created_at,
  updated_at
)
SELECT
  bc.id,
  bc.brand_id,
  'competitor',
  bc.name,
  lower(trim(regexp_replace(bc.name, '\s+', ' ', 'g'))),
  bc.website,
  lower(regexp_replace(regexp_replace(bc.website, '^https?://', ''), '/.*$', '')),
  '',
  ROW_NUMBER() OVER (PARTITION BY bc.brand_id ORDER BY bc.created_at, bc.id) - 1,
  TRUE,
  bc.created_at,
  bc.updated_at
FROM brand_competitors bc
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  normalized_name = EXCLUDED.normalized_name,
  website_url = EXCLUDED.website_url,
  website_host = EXCLUDED.website_host,
  sort_order = EXCLUDED.sort_order,
  updated_at = GREATEST(brand_entities.updated_at, EXCLUDED.updated_at);

INSERT INTO project_topics (
  id,
  project_id,
  topic_catalog_id,
  name,
  normalized_name,
  default_cadence,
  source,
  sort_order,
  is_active,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  b.id,
  NULL,
  lower(trim(topic.value)),
  lower(trim(topic.value)),
  'weekly',
  'user_added',
  topic.ordinality - 1,
  TRUE,
  b.created_at,
  b.updated_at
FROM brands b
CROSS JOIN LATERAL unnest(b.topics) WITH ORDINALITY AS topic(value, ordinality)
WHERE trim(topic.value) <> ''
ON CONFLICT (project_id, normalized_name) DO UPDATE
SET
  sort_order = EXCLUDED.sort_order,
  updated_at = GREATEST(project_topics.updated_at, EXCLUDED.updated_at);

INSERT INTO project_platforms (
  id,
  project_id,
  platform_code,
  is_enabled,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  tp.id,
  ap.code,
  TRUE,
  NOW(),
  NOW()
FROM tracking_projects tp
CROSS JOIN ai_platforms ap
ON CONFLICT (project_id, platform_code) DO NOTHING;
