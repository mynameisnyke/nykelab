-- Which stills are sharp enough for a full-width hero, and which version of the file a photograph is.
-- hero_ok: the long edge is at least 2400 px (the graded library carries its own flag in the manifest; clips are always fine).
-- rev: bumped when a photograph's file is replaced in place, so its cached sized copies (and the browser's) are regenerated.
ALTER TABLE media ADD COLUMN hero_ok INTEGER NOT NULL DEFAULT 0;
ALTER TABLE media ADD COLUMN rev     INTEGER NOT NULL DEFAULT 1;
UPDATE media SET hero_ok = CASE WHEN type = 'video' THEN 1 WHEN MAX(width, height) >= 2400 THEN 1 ELSE 0 END;
