ALTER TABLE prompt_run_responses
  ADD COLUMN IF NOT EXISTS raw_response_json_url TEXT NULL;
