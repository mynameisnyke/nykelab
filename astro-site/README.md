# nykelab · Astro prototype (Journal)

Prototype of the blog from the Figma file ("Nyke Lab 2.0" → Pages · Desktop / Mobile → JOURNAL sections), built with Astro so every post is real HTML (SEO, link previews, RSS) with almost no JavaScript. Standalone; the Vue app in the repo root is untouched.

```bash
cd astro-site
npm install
npm run dev      # http://localhost:4321/journal
npm run build    # static output in dist/
npm run check    # type + content-schema check
```

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

## Not done yet

- Photo pages (collections from D1/R2), the sunburst, the walkable gallery: these would stay Vue and mount as islands, with collection pages server-rendered by the Cloudflare adapter.
- Cloudflare deploy: this build is static; swap in `@astrojs/cloudflare` when the DB-driven pages move over.
- Menu links to `/westminster` etc. and the Instagram/Email links are placeholders.
