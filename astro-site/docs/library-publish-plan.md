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

## One page per trip, and more specific captions (2026-10-25)

- A collection on the site is now a *trip* (a catalogue voyage), named as the catalogue names it: "New Jersey", not the Lightroom folder's "Chiyuki House 2025 New Jersey".
  Each photo joins the trip whose own shots are nearest in time (`geotag-library.mjs` writes `collection` per photo); clips follow `CLIP_TRIP` in `publish-library.mjs`.
  The 44 per-folder collections an earlier run published were emptied and taken off the site (rows kept, `published = 0`). 68 pages became 34 (plus your own `bogota`).
- Captions: a landmark inside the photo's coordinates or the phone's itinerary for that day (data/landmarks.json) names the spot ("White Sands National Park, New Mexico");
  `data/photo-places.json` holds places named by eye for items with nothing else to go on. The coordinates link to Google Maps (components/GeoCaption.astro).
- Sources now: exif, phone, phone-approx, day (where the phone spent that day, or a named place: about 1 km), trip (the trip's own pin; none for a whole country or a big state).

## 2560 px stills and hero-safe photographs (2026-10-25)

- The photographs are now the 2560 px set (`photos/web2560/`, its own manifest) uploaded over the same keys (`<id>/orig.jpg`). `width`, `height`, `bytes` come from that manifest;
  `hero_ok` (long edge 2560 px) is stored as `media.hero_ok`; for anything else (own uploads) it is derived: long edge >= 2400 px. Clips are always fine.
- `media.rev` is the file version. A replaced photograph is asked for as `/m/<id>/w900.webp?r=2`, and its sized copies are cached under `<id>/w900-r2.webp`, so neither the browser
  (which cached the old ones for a year) nor storage serves a picture made from the old file. The old sized copies are left in storage (nothing was deleted).
- A hero or a full-bleed block is a landscape clip, or a landscape still with `hero_ok` (lib/hero.ts). If a collection has neither, the first landscape still is used and is soft.
- Eight photographs were re-rendered from RAW (exposure fixed): they were replaced like the rest (all 1,028 files were uploaded, compared by size and time, not skipped).

## Stills re-rendered from RAW (2026-10-26)

- 600 photographs had been graded from the camera's small embedded preview (1024 / 1616 px) and upscaled to "2560". `photos/pipeline/render_web_fromraw.py` re-renders them from the RAW with the same saved fits
  (`docs/photo-quality-audit.md`). `publish-library.mjs` gives any photo whose pixel size changed since `photos/web2560/manifest.before_fromraw.json` `rev` 3 (the rest stay at 2).
- Published to the live site; all 600 verified at full width. Two heavily cropped Fuji frames remain under 2560 px (source-limited, not hero-safe).

## Near-duplicates hidden from galleries (2026-10-26)

- Every gallery was read in page order as contact sheets; photos that nearly repeat a neighbour (same frame, same pose, same sky, same spot a minute later) were hidden: 248 of 1,028 photos in 29 galleries (780 stay). Nothing was deleted: rows and files stay, `media.published = 0`.
- `data/gallery-curation.json` is the record: each entry has the photo's media `id`, its `gallery`, its place `n` in the gallery before hiding, and `like`, the kept photo it resembles. `covers` makes one photo the first of a gallery (Comic Con 2022: `c4ed90ce01be`, was at position 14).
- Apply: `node scripts/curate-galleries.mjs --target remote` (idempotent). `publish-library.mjs` reads the same file, so a full republish keeps them hidden.
- Rewind: `node scripts/curate-galleries.mjs --target remote --restore all` (or `--restore nycc-2022,<media id>,...`) shows them again, puts covers back and removes those entries from the file. Or delete entries by hand and rerun the publisher (a restored photo returns to its rank). `/admin` can also re-publish single items.
- D1 Time Travel bookmark taken just before the change: `000000d5-00000002-00005111-02a8424c3c3a8b6461e7ef288674a064` (`wrangler d1 time-travel restore nykelab --bookmark=...` rolls the whole database back, so only use it if nothing else changed since).
- Not touched: Bogotá (your own uploads, no library id), Seoul, London, Wyoming 2020 (nothing repeats), Pennsylvania and Toko (already hidden).

## Norway clips re-checked (2026-10-26)

- **Sideways cover:** `norway_2022/C0017` is vertical footage (Sony writes no rotation flag) that the October rotation pass missed, so it was rendered sideways across a 16:9 frame and was the Norway page's hero. Added as `ccw` in `pipeline/params/rotations.json`, re-rendered from the 4K source (now 1080x1920, portrait, so never a hero). The Norway hero is now `C0018_s1`.
- **Flat grades:** `C0011` and `C0012` had highlights that never passed ~60% brightness. `pipeline/params/extra_vf.json` adds a `curves` highlight stretch after the LUT (voyages look only); `subclips.py` reads it (`EXTRA`).
- **Unusable clips** are hidden through a hand-kept `quality` list in `excluded-clips.json` (kept by `build-excluded-clips.mjs`, honoured by `publish-library.mjs`): `C0021_s1` (2.7 s of a motion-blurred wall) and `DJI_0282_s1` (soft, dull, ends on empty water). Remove an entry and republish to bring one back.
- **Replaced clips get new ids:** `/m/<id>/main.mp4` is cached for a year (immutable), so `CLIP_REV` in `publish-library.mjs` hashes a replaced clip to a new id, and the old row is retired (`published = 0`, `source_id` suffixed `#old`; the unique `source_id` index needs it freed). The old files stay in storage, still reachable by their direct URL but linked from nowhere.
- Before-state kept in `subclips/_before_norway_fix/` and `subclips/manifest.before_norway_fix.json`.

## Eureka, San Francisco and the phone videos (2026-10-27)

- **Sources.** The originals of the Nov 2020 trip (768 ARWs from SIBYL-SYSTEM) were never uploaded (`willNotUploadMaster`), so the stills are graded from Lightroom's 2560 px linear proxy DNGs in
  `~/Pictures/Lightroom Library.lrlibrary/<id>/proxies/2560/<asset id split 3 + rest>`; the original filename is inside each proxy (`OriginalRawFileName`). Orientation and crops come from the catalog
  (`Managed Catalog.mcat`, msgpack, read with `render_eureka_sf.py`'s helpers); the proxies themselves all say "normal". Eureka and San Francisco video: 1080p proxies in `gs://nl-video-welcome-full-proxies`.
- **Stills.** `photos/pipeline/render_eureka_sf.py` (fits both looks per photo, blends colour toward the trip median: `BLEND`, `PREWB` grey-world pre-correction for casts, `CHROMA` / `NOTINT` per photo),
  `stage_eureka_sf.py` (manifest + `data/library-geo.json`). Eureka is 40 photographs (cut from 70: near-duplicates and tinted frames hidden through `data/gallery-curation.json`), San Francisco 29. Rev 6.
- **Phone videos.** 128 originals pulled from iCloud through the Photos app (AppleScript `export ... with using originals`) into `phone_videos/<trip>/`; 89 graded by `pipeline/lib/grade_proxies.py`
  (phone files are full-range `yuvj420p`: `range: pc`) plus 7 proxy clips; folders `phone_<trip>` / `eureka_2020` / `san_francisco_2020`, each with its own `entries.json` merged by `publish-library.mjs`.
- **Cover.** `src/data/page-picks.json` is bundled into the Worker, so a page hero pick needs `npm run deploy`. Eureka's hero is the crouched-in-the-field portrait (`0c72f850e162`).
- **Eureka coordinates redacted (2026-10-27).** The page shows the place name only ("Eureka, California"), no coordinates or map links. `data/library-geo.json` has `lat`/`lon` null for the Eureka trip and its photos (a republish keeps them null), and the live `media` rows have `geo_lat`/`geo_lon` (and the private/city columns) set to NULL. The graded stills and clips carry no GPS metadata (the phone clips' iPhone location tag is dropped by the re-encode; checked on all 196 files).
- **San Francisco, same treatment (2026-10-27).** Cut from 29 to 16 photographs (the hillside / bay view, the leaning pine and the power-line sunset were each shown 2-6 times; two frames with washed pink / purple casts dropped), re-rendered with the Eureka colour treatment (`BLEND=0.85`), coordinates redacted (place name only: "San Francisco, California"; Alamo Square keeps its name). `stage_eureka_sf.py` redacts both galleries (`REDACT`). The 13 dropped frames are hidden through `data/gallery-curation.json`, not deleted.
- **Cartagena audit (2026-10-27).** 62 -> 44 photographs. `photos/pipeline/regrade_shadows.py` (regrade_wyoming.py's shadow recovery + crush-aware tone fit, from the RAW) re-graded 17 frames where a dog, a face or a beach scene had been graded as a silhouette (rev 7); 3 of those were then cut as repeats. 10 photos that were filed under Cartagena are Medellín (29 Jan, Medellín coordinates already stored) and moved there through `library-geo.json`. 8 near-duplicate / weak frames hidden in `data/gallery-curation.json`. The deliberate silhouettes (sunset figure, profile against orange) keep their grade.
- **Medellín audit (2026-10-27).** 45 -> 38 photographs. 10 frames re-graded from RAW with `regrade_shadows.py` (rev 8): blown whites (the white wall, bricks on a white roof, a dog on a white floor) and crushed shadows (alley dogs, dog at the window, hillside, sunset ridge, breakdancer). 7 repeats / weak frames hidden (two of three pigeon frames, a near-identical sunset ridge, a cropped headstand, a neon monstera leaf, a teal palm, a small dog on a step).
- **Westminster 2020 audit (2026-10-27).** 30 -> 21 photographs. 12 frames re-graded from RAW with `regrade_shadows.py` (rev 9): faces and black team jackets had been crushed and the arena's yellow-green cast pushed hard. Three frames come from JPEG originals (`DSC08848`, `DSC08910`, `DSC08961`), which cannot be re-graded from RAW and were left as they were. 9 repeats / soft frames hidden (the agility-course sequence, two soft crowd shots, a far crosswalk, a soft dalmatian).
- **New York audit (2026-10-27).** 70 -> 56 photographs. 7 frames re-graded from RAW with `regrade_shadows.py` (rev 10): the portrait, a scaffolded building, a tower, a pier sunset, the Brooklyn Bridge at dusk, a smokestack and a sailboat sunset had gone black. The deliberate silhouettes (the cameraman, the seated figure on the skyline, the Williamsburg Bridge) were left alone: the re-grade flattened them. 14 soft, near-duplicate or weak frames hidden (soft tower and park frames, single-tower silhouettes, a second Christmas-tree frame).
- **Norway audit (2026-10-27).** 20 -> 18 photographs. 11 frames re-graded from RAW with `regrade_shadows.py` (rev 11): dark exposures lifted (the saved fits had pulled 1-1.5 stops), the two night frames de-tinted (neon yellow-green), shadows opened under the fjord sky. 2 near-duplicates hidden (an Opera House frame, a second view of the same houses); one of those was among the re-grades, so 10 re-graded frames are live.
- **Norway skies pushed (2026-10-27).** `photos/pipeline/sky_boost.py`: a feathered sky mask (blue / violet pixels, plus smooth light pixels in the upper frame so pink and orange dawn skies count; textured rock and water are excluded) raises sky chroma by 50% and deepens blue a little (rev 12, 14 frames, both looks). A stronger setting (+90%) went electric cyan and was rejected; the night frames and one frame whose sky was already deep were left as they were. Backups: `work/web_before_norway_sky/`.
- **Sky boost on the other big-sky albums (2026-10-27).** `sky_boost.py` now has a soft chroma ceiling (`C_CAP`, default 48: a sky already vivid is not pushed further; the boost never lowers existing colour) and a `MIN_COV` filter. Applied by eye, per frame, to 102 photographs: Wyoming 2022 (22), Colorado (15), Ecuador (6), Arizona (30), New Mexico (14), Texas (15); rev 13, backups in `work/web_before_sky_all/`. Left as graded: frames whose sky already carried a dark navy / violet corner gradient (it turned into a muddy halo), skies that went near-electric, and the whole of Iceland (the mask treats the Blue Lagoon's milky water as sky). Wyoming 2020 had no frames with enough sky.
- **Medellín tone pass (2026-10-27).** Measured against the graded phone clips (p1 black 0.000, std 0.25, chroma 0.13): the stills matched on average, but frames where shadow recovery had lifted the blacks read washed. `pipeline/deepen_blacks.py` (levels: black point at the 0.5th percentile, capped, plus a mild shadow roll that fades out by mid-grey) restored rich blacks on 6 frames (shop dog, breakdancer, sunset ridge, yellow jacket, hillside worker, butterflies; rev 14, the butterflies re-graded from RAW first for natural greens). The blown-out denim-jacket-with-dogs photo is hidden (`596173`).
- **Iceland re-grade (2026-10-27).** All 16 photographs re-graded from RAW with `regrade_shadows.py` (rev 15): the saved fits had chroma at the 1.8 ceiling (neon horse, cyan lagoon) and crushed the fog beach frames to black (up to 42% of the frame); now chroma is capped, shadows recovered, faces readable. The foggy silhouette frames are now readable rather than pure silhouettes. Backups: `work/web_before_iceland/`. (`sky_boost` still skips Iceland: the mask reads the lagoon water as sky.)
- **Texas audit (2026-10-27).** 31 -> 21 photographs. All 31 re-graded from RAW with `regrade_shadows.py` (rev 16): the dark navy / violet corner halos on the dusk and night frames, a crushed Capitol, silhouetted yuccas and over-saturated rocks. 10 repeats hidden (a flat Capitol wide, the second blue-lit shed frame, three of the ocotillo / yucca frames that said the same thing, a near-duplicate mountain). The night flash frames keep their harsh flash look, which is how they were shot.
- **Arizona audit (2026-10-27).** 42 -> 29 photographs. All 42 re-graded from RAW (`regrade_shadows.py`, rev 17): the saguaro, cholla and rock silhouettes opened, harsh saturation calmed, the Grand Canyon haze and shadows recovered; then the sky boost re-applied on the fresh renders (it had been applied to the previous files, which the re-grade replaced), except two frames that went turquoise. 13 near-duplicates / weak frames hidden (Grand Canyon wides, a second dusk canyon, Sedona rock views, saguaro and cholla repeats, the mansion, a window-tree frame, the basketball court wide).
- **Toko is unlisted (2026-10-27).** `collections.published = 2` means *unlisted*: every listing query (menu, home, Places, Years, the Azure feed) filters on `published = 1`, so it appears in none of them, but `getCollectionPage` (src/lib/collections.ts) also serves a `published = 2` collection at its address (`/toko`), with `<meta name="robots" content="noindex, nofollow">` (Base.astro `noindex`). It has no "next chapter" block. `publish-library.mjs` creates `HIDDEN` collections with `published = 2`. The admin shows it as "Live" (it treats any non-zero as on). Needs `npm run deploy` for the page to answer.
- **Dust audit, Cartagena and Texas (2026-10-27).** Scanned both with looser settings than the library-wide pass and checked every candidate by eye: no sensor dust found (the candidates were sand grain, grass, noise and insects), so nothing was healed.
- **Arizona dust (2026-10-27).** The first dust pass missed Arizona's faint spots (low contrast, d 6-10 levels, in blue / grey sky). A second pass with the loosest settings (`RADIAL_MIN=0.6 DEPTH_MIN=5 MIN_R=5 WIDE_STD=14 RING_STD=5`), every candidate checked by eye, healed 16 spots in 9 photos (rev 19). Foliage, wood and cloud-texture hits were left alone. Dust positions differ from frame to frame here, so repeat-position clustering does not help.
- **Toko built out (2026-10-27).** The Lightroom Toko collection (60) and keyword (249) were never graded; the library had 4. `photos/pipeline/render_toko.py` grades from RAW (catalog orientation; the sharpest frame of each burst) with the published birthday-candle cover (`AR501137`, toko/1468867) as the colour guide: tone fitted per photo, white balance / tint / chroma pulled 55% toward the median of the four already-published Toko fits, chroma capped at 1.0. 43 photographs, cover first then chronological; two Oaxaca photos moved into Toko (`library-geo.json`). No place name and no coordinates (home and family photos). The collection stays unlisted (`published = 2`), see the entry above.
- **Toko colour and order pass (2026-10-27).** The first Toko render capped chroma at 1.0 and came out at ~65% of the cover's colour (median p90 chroma 34.6 vs 55). `photos/pipeline/render_toko_rich.py` re-renders every Toko photo except the cover: per photo, a grid search on a 640 px copy lowers exposure only as far as needed (mean L* <= 40) and raises chroma until the 90th-percentile chroma reaches 50, with limits (99th percentile chroma <= 92, no more than +2 points of blacks than the photo's own); median p90 chroma is now 49 and mean lightness 37.5 (cover 36). Skin checked at full size against the cover. Rev 20. The birthday photographs are grouped right after the cover (candle frames, then the baby moments of the same day, 8 photographs), the rest chronological: 45 photographs. Backups: `work/web_before_toko_rich/`.
- **New Lightroom photos: snow day and Toko (2026-10-28).** The live catalog (`/Volumes/Whiskey/Lightroom_BU/Lightroom Catalog-v12.lrcat`, copied with its `-wal`/`-shm` so the newest rows are read) gained 136 files (68 RAW+JPEG frames). Left out on purpose: the 24 desk shots of 27 Oct (`2026-10-27`), the 8 rejected frames of 9 May (`pick = -1`), the 9 May garbage-truck frame and the 5 Feb window-install frames (not asked for), two blank night frames. Snow day (19 Jan, Central Park) went to New York: 6 photographs (reservoir x2, field, trees, tractors x2; ranks 10.50-10.55 so they sit together); two frames of Toko in the snow went to Toko. Toko at the river (11 Sep, flash): 6 frames, ranks 48-53 after the snow pair, chronological (Toko is now 53 photographs).
  `photos/pipeline/render_new.py` grades from RAW per scene type because the library fit's mid-key bands make snow brown-grey and flash night frames glare: mode `snow` (white balance / tint 75% toward neutral, chroma 1.3, 85th-percentile lightness 82), mode `night` (Toko's reference white balance, exposure = highest that keeps the 97th percentile under L* 82, chroma raised to p90 44, cap 2.0). `stage_new.py` copies the files, appends manifest rows (backup `manifest.before_new_snow_toko.json`), scores sharpness and writes the geo entries (New York: place name only, no coordinates; Toko: none). One flash frame (`AR503431`) was dropped for a blown face. Published with the full run (14 files, 0 failures); new ids use the default rev.
