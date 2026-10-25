# Publishing the graded library (plan, 25 Oct 2026)

Source (read-only): `/Volumes/Whiskey/resolve/LibraryGrade/` (`photos/manifest.json`, `subclips/manifest.json`).
Target: the staging site (`nykelab-astro.nykelab-astro.workers.dev`), built from branch `video-support` (it has the play-on-scroll video code).

## What the manifests contain
- 1,028 photos in 68 collections (725 portrait, 303 landscape), 1280 px `voyages` look, rank 1..20 per collection.
- 543 clips (416 landscape, 127 portrait), all 8 s, 1080p H.264, silent, 16 folders, ~2.3 GB for the `voyages` look.
- No `approvals.json` was given: every photo is published, in the `voyages` look. `tmag` is not published (the site has no look switch); `neutral` is never published.
- Every entry has a local `source_path`; those are never read into the database or any output.

## Mapping onto the site (extends what exists: collection pages `/<slug>`, `media` rows in D1, files in R2)
- Photo collection -> site collection. Slug = manifest folder with `_` -> `-` (`iceland_finals_2` -> `iceland-finals-2`); title = the manifest's display name. If that slug already holds items that are not from the library (staging has your own `bogota`), the library's collection gets `-library` appended; nothing existing is touched or deleted.
- Video folder -> exactly ONE collection, so no clip is stored twice. Four folders are claimed by several photo collections (`NY` by 13, `westminster_2021` by 4, `oaxaca_2025` and `texas_2021` by 2): the clip goes to the claimant whose name matches the folder's place best (`New York`, `Westminster 2021`, `Oaxaca`, `Texas 2021`).
- Order inside a collection: photos by `rank`, clips by `quality_score`, merged so clips are spread evenly between photos and the rank-1 photo stays first (the hero).
- Collections are ordered by the date of their earliest photo.

## Storage and data
- R2 keys, stable per item: photos `<id>/orig.jpg` (the site makes 480/900/1280 WebP copies from it on first view), clips `<id>/main.mp4` + `<id>/poster.jpg`. `<id>` = first 12 hex characters of sha1("lib:" + manifest id), so re-running always gives the same keys.
- Resumable: `.publish-state/` remembers every uploaded file (size + modified time); unchanged files are skipped.
- D1: `media` rows are upserted by id (migration 0004 adds `avg_colour`, `text_on`, `look`, `source_id`, `duration`). `avg_colour` is the loading placeholder; `text_on` and `captured_at` are stored and returned by the API.
- `text_on` is stored but not applied to the page (that would change the site's text colours; the hero keeps its white-on-scrim text).

## Not done on purpose
- Proofs are 1280 px, so full-width heroes on large retina screens are slightly soft. The same keys can be overwritten later with bigger exports.
- Nothing already on the site is deleted or changed.
