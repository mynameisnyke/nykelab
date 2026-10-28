# nykelab

Nyke Harewood's site, [nykelab.nyc](https://nykelab.nyc): photographs and short clips from trips, a journal, and an endless scroll of all of it (Infinite Azure). One Astro app on one Cloudflare Worker, with no servers to keep.

| Path | What it is |
|---|---|
| [`astro-site/`](astro-site) | **The site.** Astro pages, the Hono API and D1 migrations in [`worker/`](astro-site/worker), the library publish scripts, the Playwright tests. [Its README](astro-site/README.md) is the full guide. |
| [`archive/old-site-2020-12/`](archive/old-site-2020-12) | The previous site (the 2020 build nykelab.nyc served until October 2026): screenshots, built source, network capture and recordings, kept as a record. |
| [`docs/`](docs) | Notes on the earlier Vue 3 version of this site, which lived in the repo root until 28 October 2026 (the code is in the git history). Pipeline and Lightroom docs live in `astro-site/docs`. |
| [`.github/workflows/`](.github/workflows) | CI: type-check and build on every push and pull request. |

## How it runs

- **Pages** are Astro. The journal is prerendered; photo pages, Places, Years and About are rendered from D1 on each request behind a short edge cache, so edits in the admin show up without a rebuild.
- **One Worker** ([`astro-site/src/worker.ts`](astro-site/src/worker.ts)): static assets, then the Hono API (`/api/*`; `/m/*` serves media from R2 with Range support and makes sized WebP copies on demand with Cloudflare Images; `/api/event` writes to Analytics Engine), then the Astro pages.
- **Data**: D1 `nykelab` (collections, media, counters), R2 `nykelab-media` (originals, clips, sized copies), a KV namespace for Astro sessions.
- **Admin** at `/admin`, behind Cloudflare Access. The Worker fails closed (503) until the Access identifiers are set, so a fresh deploy never exposes it.
- **Content** comes from a graded Lightroom / Resolve library on an external drive and is published with [`scripts/publish-library.mjs`](astro-site/scripts/publish-library.mjs) (resumable and idempotent: files to R2, rows to D1, nothing deleted). The originals are not in this repository.

## Quick start

```bash
cd astro-site
npm install
cp .dev.vars.example .dev.vars   # ENVIRONMENT=development: /admin works locally without an Access login
npm run seed                     # once: fills the local D1 + R2 with sample photos (never production)
npm run dev                      # http://localhost:4322
```

```bash
npm run check    # types + content schema
npm test         # Playwright, desktop + phone, with the installed Chrome; starts the dev server if it is not running
npm run deploy   # astro build + wrangler deploy (needs `npx wrangler login` as the account owner)
```

## Notes

- Nothing secret is committed. The Cloudflare Access team domain and audience tag in `wrangler.jsonc` are identifiers every visitor is redirected with, not secrets; the optional analytics token is a Wrangler secret (`CF_API_TOKEN`). Local settings go in `.dev.vars`, which is ignored.
- The archived 2020 site had a Firebase web key in its bundle and capture; it is redacted in the copy kept here.
- CI runs `npm run check` and `npm run build`. The Playwright suite needs the seeded local database and Chrome, so it stays a local step.

All photographs and videos are by Nyke Harewood.
