# nykelab

Nyke Harewood's site, [nykelab.nyc](https://nykelab.nyc): photographs, a journal, and an infinite scroll of both. Engineering first, photographs second.

| Folder | What it is |
|---|---|
| [`astro-site/`](astro-site) | **The live site.** Astro on one Cloudflare Worker (pages, API, media from R2, data in D1). Start with its README. |
| [`worker/`](worker) | The Hono API, D1 migrations and ingest code. Imported by `astro-site` (`../worker/src`), so it stays at the top level. |
| [`archive/old-site-2020-12/`](archive/old-site-2020-12) | The previous site (the 2020 build that nykelab.nyc served until October 2026): screenshots, source, network capture and recordings, kept as a record. |
| `src/`, `index.html`, `vite.config.mts`, root `package.json`, `wrangler.jsonc` | The earlier Vue 3 + Vite version of the site. **No longer deployed**; its own worker is named `nykelab`, separate from the live `nykelab-astro`. Described in [`docs/legacy-vue-app.md`](docs/legacy-vue-app.md). Do not run `npm run deploy` in the repo root. |
| [`docs/`](docs) | Notes on the legacy app. Pipeline and Lightroom docs live in `astro-site/docs`. |

## Working on the live site

```bash
cd astro-site
npm install
npm run dev       # http://localhost:4322
npx playwright test
npm run deploy    # build + wrangler deploy
```

Photos and videos come from a graded Lightroom library that is published with `astro-site/scripts/publish-library.mjs` (see `astro-site/docs/library-publish-plan.md`). The originals and the library folders are not in this repository.
