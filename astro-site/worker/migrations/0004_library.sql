-- Per-item look data for the graded library (see astro-site/docs/library-publish-plan.md).
ALTER TABLE media ADD COLUMN avg_colour TEXT NOT NULL DEFAULT '';  -- "#66646e", the loading placeholder
ALTER TABLE media ADD COLUMN text_on    TEXT NOT NULL DEFAULT '';  -- "light" | "dark": the text colour that reads best on top
ALTER TABLE media ADD COLUMN look       TEXT NOT NULL DEFAULT '';  -- "voyages" | "tmag" | ""
ALTER TABLE media ADD COLUMN source_id  TEXT;                      -- id in an imported manifest (makes re-imports idempotent)
ALTER TABLE media ADD COLUMN duration   REAL;                      -- seconds, videos
CREATE UNIQUE INDEX idx_media_source ON media (source_id) WHERE source_id IS NOT NULL;
