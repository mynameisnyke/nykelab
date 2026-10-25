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

## Result (staging, 2026-10-25)

- Published: 68 collections, 1,028 photos, 543 clips (2.40 GB uploaded). Rerunning `node scripts/publish-library.mjs --target remote` skips everything unchanged.
- Slug collision: the library's Bogota is `bogota-library` (staging's own `bogota` is untouched).
- Verified live: every clip, poster and one image variant per photo answers 200/206 (2,113 URLs); all 68 collection pages load with no broken images, video errors, failed requests or horizontal scroll at 1280 and 390 px.
- Found and fixed while verifying: the "Next chapter" row on collection pages overflowed sideways when the next title was long (`[slug].astro`: `minmax(0, 1fr)` column, wrapping heading).
- Not done on purpose: `tmag` look, `text_on` styling, home covers from each collection's rank-1 photo, higher-resolution stills (the proofs are 1280 px).

## Corrections after review (2026-10-25)

- Clip folders checked by eye against the stills, not by name. Three were wrong in the manifest's pairing:
  `New Mexico` is the same footage as `phoenix_2021` (all 18 clips identical) and it is Grand Canyon / Arizona-rim, so it is published once, under `grand-canyon`;
  the duplicate `New Mexico/*` rows were taken off the site (`published = 0`, files kept in R2);
  `uk_2023` is the Brighton seafront (2023), so it moved from `london` (2017) to `brighton`.
  The loader's `FOLDER_HOME` / `DUPLICATE_FOLDERS` tables record this.
- Place, Year and Event galleries now show the voyage's real collection photos (rank order, only from the voyage's dates),
  not the Lightroom catalogue's per-shot rows; a trip spread over several collections (Arizona, Wyoming) draws from all of them.
- Heroes are a landscape clip from the page's collections when one exists (vertical clips are not used: they crop to a thin band).
- Stills remain the 1280 px proofs. On wide screens a still hero is soft; re-exporting at 2560 px and rerunning the loader replaces the same keys.

## Where it was made (captions)

`scripts/geotag-library.mjs` writes `data/library-geo.json`; `publish-library.mjs` stores it as `place`, `geo_lat`, `geo_lon`, `geo_source` (migration 0005);
the site prints `placeLine()` (src/lib/caption.ts) under each item: "Oaxaca de Juárez, Mexico · 17.061° N, 96.726° W".

- `exif` the original's own GPS (13 stills). `phone` matched to a phone photo within minutes after finding the camera's clock error against the
  Photos library (194). `phone-approx` the clock error is only probable (large events), so coordinates are rounded to 2 decimals (159).
  `trip` no coordinates: the place of the trip, or of the collection where its name says it better (662 stills, all 197 clips: their sources carry no metadata).
- Offsets are only trusted when the episode backs them overwhelmingly, or the same camera has the same clock error elsewhere within about a year.
- Coordinates are rounded (3 decimals, about 100 m), photos made within about 800 m of the densest night-time spots in the Photos library (home) keep only their city,
  and `chiyuki_house_2025_new_jersey` is shown by place name only.
- Rerun: copy Photos.sqlite to a scratch folder, extract time and coordinates (see the header of the script), then run both scripts.
