# nykelab · Astro prototype (Journal + photo pages)

Prototype of the site in Astro, built from the Figma file ("Nyke Lab 2.0"). Every page is real HTML (SEO, link previews, RSS) with very little JavaScript. Standalone; the Vue app in the repo root is untouched.

- **Journal** (`/journal`, `/journal/<slug>`): markdown posts, prerendered.
- **Photo pages** (`/<collection-slug>`, e.g. `/grand-tetons`): server-rendered from D1 on each request (short edge cache), so edits made in the admin appear without a rebuild.
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

## Photo pages: how data flows

`src/lib/collections.ts` is the only file that reads data (D1 via `cloudflare:workers`). Pages never call the API over HTTP. If the data source changes (KV snapshot, another API, Cloudflare Images variants), only that file changes. Images are served from the existing `/m/*` route (R2, Range-capable); `srcset` uses the stored `small`/`main` variants and the stored width/height prevent layout shift. Scroll fades and analytics (`/api/event`) are small vanilla scripts (`src/scripts/photos.ts`, `src/lib/track.ts`) replacing GSAP + the Vue composables.

Layout rhythm (same idea as the Vue `CollectionView`, using the Figma sections): hero = first landscape item; remaining landscapes alternate full-bleed / inset; runs of portraits become 1–3-up rows; the next collection is shown as "Next chapter".

## Notes

- `astro.config.mjs` sets `prerenderEnvironment: "node"`. With the default (`workerd`) prerendered routes returned 404 in `astro dev` when using the custom Hono entry.
- `wrangler.jsonc` sets `html_handling: "drop-trailing-slash"` so `/journal` is served without a redirect.
- The adapter also auto-adds a `SESSION` KV binding and an `IMAGES` binding (Cloudflare Images). Neither is used yet; `IMAGES` is how responsive image variants could replace the browser-side resizing in the admin uploader.
- `hono` and `jose` are installed here and in the repo root, because `src/worker.ts` imports `../worker/src/*`. They would be one copy once the Vue app is retired.

## Not done yet

- Home (sunburst, cover crossfade), About, World (three.js walkable gallery), `/admin` (Vue SPA): the interactive pieces stay Vue and mount as Astro islands (`@astrojs/vue`) when moved.
- The Figma Offset collage and Diptych sections (they need an editorial pairing field; today layout is derived from orientation).
- The menu overlay's preview image + sunburst; menu links for About/Instagram/Email are placeholders.
- Production deploy: needs the real D1 `database_id` / Access vars in `wrangler.jsonc`, then `npm run deploy`. Not done.
