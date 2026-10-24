-- Originals-first uploads. When key_original is set, the uploaded file is kept as-is
-- (R2: <id>/orig.<ext>) and sized WebP variants (<id>/w<width>.webp) are generated on
-- first request with the Cloudflare Images binding and cached back into R2.
-- Rows without it (key_main/key_small, resized in the browser) keep working unchanged.
ALTER TABLE media ADD COLUMN key_original TEXT;
