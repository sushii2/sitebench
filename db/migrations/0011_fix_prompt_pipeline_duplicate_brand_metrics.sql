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
  canonical_website_url TEXT;
  canonical_website_host TEXT;
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
    record_prompt_platform_result.platform_code,
    record_prompt_platform_result.provider_model,
    (SELECT tracked_prompts.prompt_text FROM tracked_prompts WHERE tracked_prompts.id = prompt_run_row.tracked_prompt_id),
    record_prompt_platform_result.raw_response_text,
    COALESCE(record_prompt_platform_result.raw_response_json, '{}'::jsonb),
    'prompt_pipeline_parser_v1',
    record_prompt_platform_result.status,
    record_prompt_platform_result.latency_ms,
    record_prompt_platform_result.input_tokens,
    record_prompt_platform_result.output_tokens,
    record_prompt_platform_result.error_code,
    record_prompt_platform_result.error_message,
    NOW()
  )
  ON CONFLICT ON CONSTRAINT prompt_run_responses_prompt_run_id_platform_code_key DO UPDATE
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
    brand_entity_record := NULL;
    canonical_website_url := NULLIF(brand_item->>'canonicalWebsite', '');
    canonical_website_host := CASE
      WHEN canonical_website_url IS NULL THEN NULL
      ELSE lower(regexp_replace(split_part(canonical_website_url, '/', 3), '^www\.', ''))
    END;

    SELECT *
    INTO brand_entity_record
    FROM brand_entities
    WHERE brand_entities.project_id = prompt_run_row.project_id
      AND (
        (
          canonical_website_host IS NOT NULL
          AND brand_entities.website_host = canonical_website_host
        )
        OR brand_entities.normalized_name = lower(brand_item->>'name')
      )
    ORDER BY CASE
      WHEN canonical_website_host IS NOT NULL
        AND brand_entities.website_host = canonical_website_host
      THEN 0
      ELSE 1
    END
    LIMIT 1;

    IF brand_entity_record.id IS NULL AND canonical_website_host IS NOT NULL THEN
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
        canonical_website_url,
        canonical_website_host,
        '',
        999,
        TRUE
      )
      ON CONFLICT ON CONSTRAINT brand_entities_project_id_website_host_key DO NOTHING
      RETURNING * INTO brand_entity_record;

      IF brand_entity_record.id IS NULL THEN
        SELECT *
        INTO brand_entity_record
        FROM brand_entities
        WHERE brand_entities.project_id = prompt_run_row.project_id
          AND (
            brand_entities.website_host = canonical_website_host
            OR brand_entities.normalized_name = lower(brand_item->>'name')
          )
        ORDER BY CASE
          WHEN brand_entities.website_host = canonical_website_host THEN 0
          ELSE 1
        END
        LIMIT 1;
      END IF;
    END IF;

    IF brand_entity_record.id IS NOT NULL THEN
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
      ON CONFLICT ON CONSTRAINT response_brand_metrics_response_id_brand_entity_id_key DO UPDATE
      SET rank_position = EXCLUDED.rank_position,
          mention_count = response_brand_metrics.mention_count + EXCLUDED.mention_count,
          visibility_score = GREATEST(
            response_brand_metrics.visibility_score,
            EXCLUDED.visibility_score
          ),
          recommendation_status = EXCLUDED.recommendation_status,
          sentiment_label = EXCLUDED.sentiment_label,
          sentiment_score = COALESCE(
            EXCLUDED.sentiment_score,
            response_brand_metrics.sentiment_score
          ),
          citation_score = GREATEST(
            response_brand_metrics.citation_score,
            EXCLUDED.citation_score
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
      LIMIT 1
      ON CONFLICT ON CONSTRAINT response_brand_citations_response_brand_metric_id_response_citation_id_key DO NOTHING;
    END IF;
  END LOOP;
END;
$$;
