-- Where a photo or clip was made, for the caption under it (see astro-site/scripts/geotag-library.mjs).
-- Public by design and already rounded (3 decimals, about 100 m; 2 when the match is approximate); the exact GPS fix stays private.
ALTER TABLE media ADD COLUMN geo_lat    REAL;
ALTER TABLE media ADD COLUMN geo_lon    REAL;
ALTER TABLE media ADD COLUMN geo_source TEXT NOT NULL DEFAULT '';  -- "exif" | "phone" | "phone-approx" | "trip" | ""
