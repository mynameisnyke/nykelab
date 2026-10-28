-- What a photo says about itself, read from its EXIF / IPTC / XMP when it is uploaded (worker/src/ingest.ts).
-- caption / place already existed; they are now auto-filled from the file when left blank.
--
-- PRIVACY: gps_lat / gps_lon hold the exact GPS fix. No API returns them; the public place is the city
-- (place, city, region, country, place_lat, place_lon, from the offline GeoNames lookup).
ALTER TABLE media ADD COLUMN captured_at    TEXT;                     -- local wall clock, "2020-01-30T05:56:22"
ALTER TABLE media ADD COLUMN camera         TEXT NOT NULL DEFAULT '';
ALTER TABLE media ADD COLUMN lens           TEXT NOT NULL DEFAULT '';
ALTER TABLE media ADD COLUMN focal          REAL;
ALTER TABLE media ADD COLUMN aperture       REAL;
ALTER TABLE media ADD COLUMN iso            INTEGER;
ALTER TABLE media ADD COLUMN shutter        TEXT NOT NULL DEFAULT '';
ALTER TABLE media ADD COLUMN city           TEXT NOT NULL DEFAULT '';
ALTER TABLE media ADD COLUMN region         TEXT NOT NULL DEFAULT '';
ALTER TABLE media ADD COLUMN country        TEXT NOT NULL DEFAULT '';
ALTER TABLE media ADD COLUMN country_code   TEXT NOT NULL DEFAULT '';
ALTER TABLE media ADD COLUMN place_lat      REAL;                     -- city coordinates (public)
ALTER TABLE media ADD COLUMN place_lon      REAL;
ALTER TABLE media ADD COLUMN place_source   TEXT NOT NULL DEFAULT ''; -- 'tags' | 'gps' | 'manual' | ''
ALTER TABLE media ADD COLUMN caption_source TEXT NOT NULL DEFAULT ''; -- 'photo' | 'manual' | ''
ALTER TABLE media ADD COLUMN gps_lat        REAL;                     -- PRIVATE
ALTER TABLE media ADD COLUMN gps_lon        REAL;                     -- PRIVATE
ALTER TABLE media ADD COLUMN meta_read_at   TEXT;
