# nykelab · the Astro site (nykelab.nyc)

The live site: Astro on one Cloudflare Worker, built from the Figma file ("Nyke Lab 2.0"). Every page is real HTML (SEO, link previews, RSS) with very little JavaScript. It shares the Worker API in `../worker` with the older Vue app in the repo root, which is no longer deployed (see `../README.md`).

- **Journal** (`/journal`, `/journal/<slug>`): markdown posts, prerendered.
- **Photo pages** (`/<collection-slug>`, e.g. `/grand-tetons`) and **About** (`/about`): server-rendered from D1 on each request (short edge cache), so edits made in the admin appear without a rebuild.
- **Admin** (`/admin`): the existing Vue admin as an Astro page with a Vue island (`client:only`), styled with Tailwind 4 scoped to that page. Guarded by Cloudflare Access plus the Worker's fail-closed `requireAdmin` (503 until `ACCESS_*` are set outside development).
- **One Worker** (`src/worker.ts`): static assets → the existing Hono API (`../worker/src`, shared unchanged: `/api/*`, `/m/*` media from R2, analytics) → Astro pages.

```bash
cd astro-site
npm install
npm run seed     # once: fills LOCAL D1 + R2 with the Figma photos (.wrangler/state, never production)
npm run dev      # http://localhost:4322/journal  and  /grand-tetons
npm run build    # → dist/client (static) + dist/server (Worker)
npm run check    # type + content-schema check
npx wrangler dev --persist-to .wrangler/state   # run the production build locally (after build)
```

`npm run types` regenerates `worker-configuration.d.ts` after changing `wrangler.jsonc`.

## Tests

```bash
npm run dev     # in one terminal (port 4322); `npm test` starts it if it is not running
npm test        # Playwright, desktop + phone, uses the installed Chrome (no browser download)
```

`tests/site.spec.ts`: every page loads with no console errors or failed requests; every internal link resolves; nothing blocks a click on any link or button (the `/places` bug); the menu matches the bottom nav and is keyboard-operable; theme, home views, places filter, soft navigation. `tests/a11y.spec.ts`: axe WCAG 2.1 A/AA on every page in both themes. The link-preview card (`public/og.png`) is regenerated from `scripts/og.html` (command in the file).

## Writing a post

Add a `.md` or `.mdx` file to `src/content/journal/`. Frontmatter (schema in `src/content.config.ts`):

```yaml
title: ...
description: one line — list summary, post intro, meta description
date: 2026-10-24
tags: [Code, Cloudflare]   # first tag = category (filter pill)
cover: ../../assets/journal/photo.jpg   # optional → thumbnail in the list
coverAlt: ...
draft: true                # optional; drafts show in dev only
```

Code fences accept a filename: ` ```ts title="worker/index.ts" `. In `.mdx`, use `<Figure src={img} alt="" caption="" />` for captioned images.

## Where the Figma lives in the code

| Figma | Code |
|---|---|
| Variables (Theme · Scale · Layout) | CSS custom properties in `src/styles/global.css` (`data-theme="light"` swaps the Theme set) |
| Logo | `src/components/Logo.astro` (Figma: Navigation, Logo set; NYKE with the Y drawn as a tick + LAB pill) |
| Navbar + MenuOverlay | `src/components/Navbar.astro` (menu = the five main destinations from `src/lib/nav.ts` + a small Voyages group + Email; no preview photo or sunburst, on purpose) |
| Pill | `src/components/Pill.astro` |
| PostRow (Cover=None/Thumb) | `src/components/PostRow.astro` |
| JournalHeader + filters | `src/components/JournalIndex.astro` |
| Post page, CodeBlock, pull quote | `src/pages/journal/[slug].astro` (`.prose` styles) |
| Story page: Hero, FullBleed, GalleryRow, InsetFeature, NextChapter, ChapterNav | `src/pages/[slug].astro`, `src/components/ChapterNav.astro`, `MediaItem.astro` |

## Home: the archive as a map

`/` is a metadata-driven home: **Where** (three.js globe: voyages as stems, a bloom of photographs, arcs in date order), **When** (d3: date across, time of day down, so golden hour shows up on its own; drag across dates to filter), **How** (d3: focal length × aperture bubbles; click to filter). All three, the voyage list and the preview card share one store (`src/scripts/home/store.ts`), so hovering or filtering in one view updates the others. `/#when` and `/#how` deep-link a view. The list is real, crawlable links and keyboard accessible; without WebGL the 2D views are used.

- **The data is your Lightroom catalog.** `npm run catalog -- <photos.csv>` turns the Lightroom CSV into `src/data/catalog.json` (what the pages read) and `docs/catalog-report.md` (every decision it made). See "Catalog pipeline" below. The photographs themselves are not uploaded yet, so voyage covers and previews borrow from the few uploaded photos.
- Privacy plan for real data: strip EXIF from public images, round public coordinates to roughly city level, keep exact values admin-only.
- Weight: the home page script is ~735 kB raw / ~190 kB gzip (three + d3 + land outline) and loads only on `/`. Next step if needed: dynamic-import three only for the Where view.

## Catalog pipeline (Lightroom CSV to the site)

```bash
npm run catalog -- /Volumes/Whiskey/photos-3plus-or-picked.csv   # rerun whenever the CSV changes
```

- **Which collections form which voyage, and where it is:** `scripts/catalog/voyages.mjs` (hand-curated; `approx: true` marks a stand-in coordinate; `kind: "event"` keeps Westminster and NYCC on the home list and Years but off the Places map; Teen Wolf is a panel inside NYCC 2022). Collections not listed are reported, not imported.
- **One row per photograph:** de-duplicated by `lr_id` (a photo in Cartagena and Cartagena Finals counts once), rejects dropped. "Finals" collections mix trips, so a photo dated outside its voyage's main date cluster moves to the voyage whose dates contain it.
- **Location is the voyage's place**, city level, never a photograph's GPS (GPS only refines `approx` places, rounded to 0.1 degree). `utc_offset` is ignored: the cameras stamped it wrong.
- **Clock correction:** the A7 III clock is about 12 hours off. For each (voyage, camera, date) group with at least 12 photos that reads at least 80% night by the wall clock and at most 10% night once flipped, the hour is flipped, **same calendar date**. A doubtful day follows a flipped day of the same camera on the same voyage. Override per voyage or group in `scripts/catalog/clock-overrides.json` (`0` = leave, `12` = flip). The report lists every flip and every day left alone. Check dates against brightness before trusting the day-level result.
- **Camera settings are bucketed** (focal lengths to 15 bins, apertures to third-stop values) so the How view reads as bubbles, not noise.
- **Transport:** the home page ships the shots as compact arrays (`packHome` / `unpackHome` in `src/lib/voyages.ts`), about 47 kB gzipped for 6,678 photographs.

## Archive: Places and Years

`/places` and `/years` (Figma: ARCHIVE · PLACES & YEARS) are generated from the same Voyage/Shot metadata as the home page; nothing about them is written by hand.

- **Places**: dotted flat map (pin size = photographs; hover a pin or a tile and the other one lights up), country filters, tiles with cover, country · photographs and date span. Voyages roll up into places (`placeSlug` on each voyage: Tetons + Yellowstone → Wyoming). Logic: `derivePlaces()` in `src/lib/voyages.ts`; components `PlacesMap`, `PlaceCard`; behaviour in `src/scripts/archive.ts`.
- **Years**: numeral, contact strip, computed stats (photographs · voyages · countries, most-used setting) and photographs per month coloured by that month's main voyage. Hovering a row dims the others with pure CSS (`:has`). Logic: `deriveYears()`; component `YearRow`.
- **Events**: `/events` and `/events/<series>` (Westminster, NYCC). Recurring events are voyages of `kind: "event"` with a `series` (`scripts/catalog/voyages.mjs`, `SERIES` holds the display name and one-liner); each edition is one gallery group, and an edition card on the index deep-links to it (`#westminster-2020`). Events stay off the Places map but show on the home list and in Years. Reached from the archive tabs (Voyages · Places · Years · Events), not the main nav, so the menu and bottom nav stay the five main destinations. Logic: `deriveEvents()` in `src/lib/voyages.ts`; `EventCard`. Figma: Pages · Desktop / Mobile, sections ARCHIVE · EVENTS and GALLERIES · EVENT; components EventCard, ArchiveTabs (Events tab + Device), VoyageItem (Event tag).
- **Map data**: `src/lib/land-dots.json` is generated by `node scripts/gen-land.mjs` (3° land grid from `world-atlas`); the dots are a single SVG path.
- **Galleries**: `/places/<slug>` and `/years/<year>` (Figma: GALLERIES · PLACE & YEAR). Full-bleed cover (the year is a 300px numeral), a facts strip computed from metadata (`MetaStrip`: photographs · voyages · dates/countries · most-used setting · golden-hour share), for years the per-month bars (`MonthBars`, shared with `YearRow`), then one `GalleryGroup` per voyage in the place/year with metadata-line captions (`metaLine()`), and a `NextBlock` (next place / next year). Photos per group come from `pickPhotos()` (portraits first); unknown slugs and years return a real 404.
- The menu footer now links Places and Years; the Figma MenuOverlay footer has not been updated to match.

## Uploads and image sizes

- **Any file size.** The admin cuts a file into 16 MiB chunks and sends each as its own request (`POST /api/admin/uploads` → `PUT …/parts/:n` → `POST …/complete`); the Worker forwards them to an R2 multipart upload. No chunk is near the Worker body limit, so photos (≤200 MB) and videos (≤2 GB) both work. True browser→R2 presigned uploads would also need an R2 API token and bucket CORS; this needs neither.
- **Originals first.** Photos are no longer resized in the browser. The original is stored as `<id>/orig.<ext>` and `media.key_original` is set (migration `0002_original.sql`).
- **Variants on demand.** `/m/<id>/w{480,900,1440,2400}.webp` is generated from the original with the Cloudflare Images binding on first request, cached in R2, and served immutable. Widths never upscale past the original, and `srcset` lists only real widths (`urls.variants` in the API). Deleting a photo removes the original and every cached variant.
- Older rows (browser-resized `main`/`small`) keep working unchanged.
- HEIC/AVIF originals are not accepted yet (the browser must decode the file to read its size); export JPEG.
- After pulling this change, run the new migration on any existing database: `npm run db:migrate:local` / `npm run db:migrate:remote` (root app) or `npm run seed` (astro-site local data).

## Photo pages: how data flows

`src/lib/collections.ts` is the only file that reads data (D1 via `cloudflare:workers`). Pages never call the API over HTTP. If the data source changes (KV snapshot, another API, Cloudflare Images variants), only that file changes. Images are served from the existing `/m/*` route (R2, Range-capable); `srcset` uses the stored `small`/`main` variants and the stored width/height prevent layout shift. Scroll fades and analytics (`/api/event`) are small vanilla scripts (`src/scripts/photos.ts`, `src/lib/track.ts`) replacing GSAP + the Vue composables.

Layout rhythm (same idea as the Vue `CollectionView`, using the Figma sections): hero = first landscape item; remaining landscapes alternate full-bleed / inset; runs of portraits become 1–3-up rows; the next collection is shown as "Next chapter".

## Video (local watcher; the converted clips are what the site serves)

Video is for short, silent background clips (10–30 s, like the New York Times' interactive features): muted, inline, looping, playing only while on screen.

**Drop a clip, get a web clip.** The watcher converts anything a camera or phone makes to a web-friendly H.264 MP4 and uploads it to the admin:

```bash
npm run dev                         # the site + admin on localhost:4322 (no login in dev)
npm run video:watch                 # in a second terminal; Ctrl-C to stop
npm run video:watch -- --once       # convert what is there now and exit
npm run video:watch -- --no-upload  # only convert (files land in the out folder)
```

Folders: `<watch>/<collection>/<clip>.mov` (the folder name is the collection: `bogota` creates "Bogota" at `/bogota`; clips directly in the watch folder go to `--collection`, default `videos`). Default watch folder `/Volumes/Whiskey/Exports/video-in` (or `~/Movies/nykelab-video-in`; override with `--watch` or `NYKELAB_VIDEO_WATCH`); converted files and posters go to a sibling `video-out/`. A file is converted once it has stopped growing (finished copying) and is remembered in `video-out/.video-state.json`; a changed file is converted again. Options: `--max-edge 1920 --crf 23 --max-seconds 0 --keep-audio --api URL --interval 3`.

What the conversion does (`scripts/video/convert.mjs`): H.264 High, yuv420p, `+faststart`, **no audio**, longest edge capped at 1920 (never enlarged), 30 fps cap, bit rate capped at 8 Mbit/s, a keyframe every second, HDR (iPhone HLG / PQ) tone-mapped to SDR, portrait kept portrait, plus a poster JPEG. A phone clip's own GPS and capture time fill in its place like a photo's (`worker/src/admin.ts`, `videoMeta`). To upload to a deployed site later, set `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` (an Access service token) and pass `--api`.

On the page (`src/scripts/video.ts`): the file is not requested until the clip is about a screen away, it plays while a quarter of it is visible and pauses when scrolled out or the tab is hidden, and with "reduce motion" or Data Saver on nothing plays or downloads (the poster stays). Needs `ffmpeg` / `ffprobe` on the PATH (`FFMPEG` / `FFPROBE` env to override). Tests: `tests/video.spec.ts` (generates real clips, runs the converter, the watcher end to end, and the browser behaviour).

## Upload metadata (caption and place filled in automatically)

When a photo is uploaded the Worker reads its own tags from the stored original (`worker/src/ingest.ts`, EXIF / IPTC / XMP via `exifr`) and fills in what you left blank; anything you type wins and is remembered as typed.

| Field | Where it comes from |
|---|---|
| **Caption** | XMP description, IPTC caption, then EXIF ImageDescription. Camera defaults ("SONY DSC", file names, one-word junk) are ignored. |
| **Place** | 1) place text written in Lightroom (IPTC/XMP city, state, country), else 2) GPS, as the biggest city within 20 km (`worker/src/places.ts`, offline GeoNames `cities15000`, CC BY 4.0, regenerate with `node worker/scripts/build-cities.mjs`); far from any city it is region and country only. |
| **Capture time, camera, lens, focal length, aperture, shutter, ISO** | EXIF. Stored in `media` (migration `0003_photo_meta.sql`) and returned by the API. |
| **Exact GPS fix** | Stored in `gps_lat` / `gps_lon` for the admin's own use. **No API returns it** (tests assert this); the public place is the city. |

The admin shows where each value came from and has **Re-read** (one photo) and **Re-read all from photos** (typed values are kept; `{"overwrite": true}` on `POST /api/admin/media/:id/read-metadata` replaces them). Test photos with known tags are in `tests/fixtures` (made with exiftool); `tests/ingest.spec.ts` and `tests/upload-metadata.spec.ts` cover the reader and the whole upload path.

Export from Lightroom with **All Metadata** and without "Remove Location Info", otherwise there is nothing to read. Photos that carry neither GPS nor place text get no place; the site then falls back to the collection's place.

## Going live

The site has been live on https://nykelab.nyc since 25 Oct 2026 (`www` redirects to the apex; the staging address https://nykelab-astro.nykelab-astro.workers.dev stays up). Deploy with `npm run deploy` (build + `wrangler deploy`; it needs `wrangler login` as the account owner).

`wrangler.jsonc` is production by default (`ENVIRONMENT: "production"`): `/admin` and `/api/admin/*` require a valid Cloudflare Access login. Local development gets `ENVIRONMENT=development` from `.dev.vars` (gitignored); in a new checkout recreate it: `echo ENVIRONMENT=development > astro-site/.dev.vars`.

How the domain was attached (kept for reference):

1. **DNS:** in the Cloudflare dashboard for the `nykelab.nyc` zone, delete any old `A` records for the apex and the `www` `CNAME` (the previous host). Keep every `MX` and `TXT` record (Gmail, SPF, Google verification). The `routes` attach fails while old records exist (error 100117), and because declaring `routes` switches `*.workers.dev` off by default, `workers_dev: true` stays explicit in `wrangler.jsonc`.
2. **Admin:** in Zero Trust > Access > the `nykelab-astro` application, `nykelab.nyc/admin*` and `nykelab.nyc/api/admin/*` must be destinations. Check from a private window: `/admin` redirects to the Access login, `/api/admin/me` is 401/403.
3. **Counter:** reset the view counter after testing on the live site: `npx wrangler d1 execute DB --remote --command "UPDATE counters SET n = 0 WHERE name = 'views'"`.
4. **Analytics (optional):** the `EVENTS` binding writes every page / photo / video event to Analytics Engine. To read it in the admin Stats tab: set `CF_ACCOUNT_ID` in `wrangler.jsonc` vars and `npx wrangler secret put CF_API_TOKEN` (a token with Account Analytics: Read).

## Notes

- `astro.config.mjs` sets `prerenderEnvironment: "node"`. With the default (`workerd`) prerendered routes returned 404 in `astro dev` when using the custom Hono entry.
- `wrangler.jsonc` sets `html_handling: "drop-trailing-slash"` so `/journal` is served without a redirect.
- The adapter also auto-adds a `SESSION` KV binding and an `IMAGES` binding (Cloudflare Images). Neither is used yet; `IMAGES` is how responsive image variants could replace the browser-side resizing in the admin uploader.
- `hono` and `jose` are installed here and in the repo root, because `src/worker.ts` imports `../worker/src/*`. They would be one copy once the Vue app is retired.

## Not done yet

- World (three.js walkable gallery): deliberately skipped for now. When wanted, it mounts as Vue islands like the admin does. (The admin's "In World" checkbox and the `featured` flag are kept so nothing is lost.)
- The Figma Offset collage and Diptych sections (they need an editorial pairing field; today layout is derived from orientation).
- Dropped on purpose: the menu overlay's voyage preview photo and sunburst (the home globe replaced the sunburst; the menu lists the main destinations). The Figma MenuOverlay and Sunburst components still show the old design. About links: GitHub, LinkedIn and Email are the real ones. There is no Instagram account, so none is linked.
