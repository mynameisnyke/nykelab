# nykelab · Astro prototype (Journal + photo pages)

Prototype of the site in Astro, built from the Figma file ("Nyke Lab 2.0"). Every page is real HTML (SEO, link previews, RSS) with very little JavaScript. Standalone; the Vue app in the repo root is untouched.

- **Journal** (`/journal`, `/journal/<slug>`): markdown posts, prerendered.
- **Photo pages** (`/<collection-slug>`, e.g. `/grand-tetons`) and **About** (`/about`): server-rendered from D1 on each request (short edge cache), so edits made in the admin appear without a rebuild.
- **Admin** (`/admin`): the existing Vue admin as an Astro page with a Vue island (`client:only`), styled with Tailwind 4 scoped to that page. Guarded by Cloudflare Access plus the Worker's fail-closed `requireAdmin` (503 until `ACCESS_*` are set outside development).
- **One Worker** (`src/worker.ts`): static assets → the existing Hono API (`../worker/src`, shared unchanged: `/api/*`, `/m/*` media from R2, analytics) → Astro pages.

```bash
cd astro-site
npm install
npm run seed     # once: fills LOCAL D1 + R2 with the Figma photos (.wrangler/state, never production)
npm run dev      # http://localhost:4321/journal  and  /grand-tetons
npm run build    # → dist/client (static) + dist/server (Worker)
npm run check    # type + content-schema check
npx wrangler dev --persist-to .wrangler/state   # run the production build locally (after build)
```

`npm run types` regenerates `worker-configuration.d.ts` after changing `wrangler.jsonc`.

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
| Navbar + MenuOverlay | `src/components/Navbar.astro` (menu = list + footer links; preview image + sunburst come with the photo pages) |
| Pill | `src/components/Pill.astro` |
| PostRow (Cover=None/Thumb) | `src/components/PostRow.astro` |
| JournalHeader + filters | `src/components/JournalIndex.astro` |
| Post page, CodeBlock, pull quote | `src/pages/journal/[slug].astro` (`.prose` styles) |
| Story page: Hero, FullBleed, GalleryRow, InsetFeature, NextChapter, ChapterNav | `src/pages/[slug].astro`, `src/components/ChapterNav.astro`, `MediaItem.astro` |

## Home: the archive as a map (prototype)

`/` is a metadata-driven home: **Where** (three.js globe: voyages as stems, a bloom of photographs, arcs in date order), **When** (d3: date across, time of day down, so golden hour shows up on its own; drag across dates to filter), **How** (d3: focal length × aperture bubbles; click to filter). All three, the voyage list and the preview card share one store (`src/scripts/home/store.ts`), so hovering or filtering in one view updates the others. `/#when` and `/#how` deep-link a view. The list is real, crawlable links and keyboard accessible; without WebGL the 2D views are used.

- **The data is SAMPLE data** (`buildSample()` in `src/lib/voyages.ts`; the page says so). Real values come from EXIF at upload (capture time, GPS, focal length, aperture, ISO, shutter, lens) plus a place name; the rest of the code already works on that `Voyage` / `Shot` shape. Photos uploaded before originals were kept have no EXIF (the old pipeline stripped it) and need re-uploading or manual values.
- Privacy plan for real data: strip EXIF from public images, round public coordinates to roughly city level, keep exact values admin-only.
- Weight: the home page script is ~735 kB raw / ~190 kB gzip (three + d3 + land outline) and loads only on `/`. Next step if needed: dynamic-import three only for the Where view.

## Archive: Places and Years (prototype)

`/places` and `/years` (Figma: ARCHIVE · PLACES & YEARS) are generated from the same Voyage/Shot metadata as the home page; nothing about them is written by hand.

- **Places**: dotted flat map (pin size = photographs; hover a pin or a tile and the other one lights up), country filters, tiles with cover, country · photographs and date span. Voyages roll up into places (`placeSlug` on each voyage: Tetons + Yellowstone → Wyoming). Logic: `derivePlaces()` in `src/lib/voyages.ts`; components `PlacesMap`, `PlaceCard`; behaviour in `src/scripts/archive.ts`.
- **Years**: numeral, contact strip, computed stats (photographs · voyages · countries, most-used setting) and photographs per month coloured by that month's main voyage. Hovering a row dims the others with pure CSS (`:has`). Logic: `deriveYears()`; component `YearRow`.
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

## Notes

- `astro.config.mjs` sets `prerenderEnvironment: "node"`. With the default (`workerd`) prerendered routes returned 404 in `astro dev` when using the custom Hono entry.
- `wrangler.jsonc` sets `html_handling: "drop-trailing-slash"` so `/journal` is served without a redirect.
- The adapter also auto-adds a `SESSION` KV binding and an `IMAGES` binding (Cloudflare Images). Neither is used yet; `IMAGES` is how responsive image variants could replace the browser-side resizing in the admin uploader.
- `hono` and `jose` are installed here and in the repo root, because `src/worker.ts` imports `../worker/src/*`. They would be one copy once the Vue app is retired.

## Not done yet

- Home (sunburst, cover crossfade) and World (three.js walkable gallery): deliberately skipped for now. When wanted, they mount as Vue islands like the admin does. (The admin's "In World" checkbox and the `featured` flag are kept so nothing is lost.)
- The Figma Offset collage and Diptych sections (they need an editorial pairing field; today layout is derived from orientation).
- The menu overlay's preview image + sunburst; the Instagram/Email menu links are placeholders. About links: GitHub, LinkedIn and Email are the real ones from the old About page; the Figma's Instagram pill is left out (no handle on record).
- Production deploy: needs the real D1 `database_id` / Access vars in `wrangler.jsonc`, then `npm run deploy`. Not done.
