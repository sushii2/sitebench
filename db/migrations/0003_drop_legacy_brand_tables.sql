CREATE TABLE IF NOT EXISTS brands_legacy_backup AS
TABLE brands;

CREATE TABLE IF NOT EXISTS brand_competitors_legacy_backup AS
TABLE brand_competitors;

DROP TABLE IF EXISTS brand_competitors;
DROP TABLE IF EXISTS brands;
