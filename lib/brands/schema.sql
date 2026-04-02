CREATE TABLE brands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  website TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  topics TEXT[] NOT NULL DEFAULT '{}'::text[],
  onboarding_completed_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE brand_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX brand_competitors_brand_id_idx ON brand_competitors (brand_id);
CREATE INDEX brand_competitors_user_id_idx ON brand_competitors (user_id);
CREATE INDEX brands_user_id_idx ON brands (user_id);

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE brand_competitors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "brands_select_own" ON brands
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "brands_insert_own" ON brands
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "brands_update_own" ON brands
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "brands_delete_own" ON brands
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "brand_competitors_select_own" ON brand_competitors
  FOR SELECT
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "brand_competitors_insert_own" ON brand_competitors
  FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "brand_competitors_update_own" ON brand_competitors
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "brand_competitors_delete_own" ON brand_competitors
  FOR DELETE
  USING (user_id = (SELECT auth.uid()));

CREATE TRIGGER brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER brand_competitors_updated_at
  BEFORE UPDATE ON brand_competitors
  FOR EACH ROW
  EXECUTE FUNCTION system.update_updated_at();
