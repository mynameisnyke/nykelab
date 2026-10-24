# nykelab

Vue 3 + Vite front end, served by a single Cloudflare Worker that also provides the API, media storage, admin and first-party analytics. No external servers.

| Concern | Cloudflare piece | Where |
|---|---|---|
| Site (static assets, SPA fallback) | Workers Static Assets | `dist/client` (built by Vite) |
| API + admin + analytics collector | Worker (Hono) | `worker/src` |
| Photos & videos | R2 bucket `nykelab-media` | served at `/m/<id>/<file>` (Range-capable) |
| Metadata (collections, captions, order) | D1 database `nykelab` | `worker/migrations` |
| Page / photo / video view events | Analytics Engine dataset `nykelab_events` | `POST /api/event` |
| Admin login | Cloudflare Access (+ JWT check in the Worker) | `worker/src/auth.ts` |

Content lives in the database, not in code. Upload in **/admin**; it appears on the site on the next page load, with no rebuild or deploy.

## Local development

```bash
npm install
npm run db:migrate:local   # once, creates the local D1 schema
npm run dev                # site + Worker + local D1/R2 on http://localhost:5173
```

- `.dev.vars` (git-ignored; copy from `.dev.vars.example`) sets `ENVIRONMENT=development`, which skips Cloudflare Access so you can use `/admin` locally. Anything else requires a valid Access JWT, so **production fails closed**.
- Local data lives in `.wrangler/state`. Delete that folder to reset (then re-run `db:migrate:local`).
- `npm run typecheck` checks the Vue app and the Worker. `npm run build` does not run it, so a type error can't block a deploy.

## The admin (`/admin`)

- **Library**: drag in photos/videos. Photos are resized in the browser to WebP (2400px full + 900px mobile); videos upload as-is with a poster frame taken in the browser. Then edit captions/places, publish/unpublish, mark photos *In World* (shows in the 3D `/world` gallery), move between collections, reorder, delete.
- **Collections**: each collection is a page at `/<slug>` and a nav entry. Empty or unpublished collections are hidden from the nav. The home sunburst is built from the collections' contents.
- **Stats**: top pages, most-viewed media, video plays/completions. Needs the setup below.

Limits: uploads go through the Worker, so a single file is capped at **100 MB** (Cloudflare's request-body limit on Free/Pro); compress longer videos first (MP4/H.264 or WebM). HEIC photos can't be decoded by most browsers; export JPEG. Unpublished items are hidden from the site and API, but their files are still reachable by direct URL if someone knows the random id.

## Analytics

First-party and cookie-less. The site sends `page_view`, `media_view` (≥50% visible for 1s, once per page load), `video_play` and `video_progress` (25/50/75/100%) to `/api/event`. Events are keyed by the media's stable id, so counts survive caption edits and reordering. Bots are ignored. Data is stored in Analytics Engine and queried with SQL from the Stats tab.

## Deploying to Cloudflare

You need a Cloudflare account with the `nykelab.nyc` zone added (so the domain's nameservers are Cloudflare's).

1. **Log in:** `npx wrangler login`
2. **Create resources** (or let `wrangler deploy` auto-provision D1/R2, which also works on recent wrangler):
   ```bash
   npx wrangler d1 create nykelab            # copy the database_id into wrangler.jsonc -> d1_databases[0]
   npx wrangler r2 bucket create nykelab-media
   ```
3. **Deploy, then create the schema:**
   ```bash
   npm run deploy
   npm run db:migrate:remote
   ```
4. **Protect the admin (do this before sharing the URL).** Zero Trust → Access → Applications → *Self-hosted*:
   - Destinations: `nykelab.nyc/admin*` and `nykelab.nyc/api/admin/*` (use your `*.workers.dev` hostname too if you test there)
   - Policy: *Allow*, include your email only
   - Copy the application's **Audience (AUD) tag** and your **team domain** (`<team>.cloudflareaccess.com`) into `wrangler.jsonc` as `ACCESS_AUD` and `ACCESS_TEAM_DOMAIN`, optionally `ADMIN_EMAILS`, then `npm run deploy` again.
   - Verify: while logged in, `https://nykelab.nyc/api/admin/me` returns your email; in a private window `/admin` redirects to the Access login, and `/api/admin/me` returns 401/403. Until `ACCESS_*` are set, admin endpoints return 503 (intentional).
5. **Custom domain:** add to `wrangler.jsonc`, then `npm run deploy`:
   ```jsonc
   "routes": [{ "pattern": "nykelab.nyc", "custom_domain": true }]
   ```
6. **Stats tab (optional):** set `CF_ACCOUNT_ID` in `wrangler.jsonc`, create an API token with *Account → Account Analytics → Read*, and store it: `npx wrangler secret put CF_API_TOKEN`.

Backups: D1 has Time Travel (`wrangler d1 time-travel`). R2 objects are not versioned, so keep your originals.

## Layout

```
worker/src/index.ts     Hono app (mounts the routes below)
worker/src/public.ts    GET /api/collections, /api/media, /m/* (R2 + Range)
worker/src/admin.ts     /api/admin/* uploads, media + collection CRUD, ordering
worker/src/auth.ts      Cloudflare Access JWT verification (fails closed)
worker/src/events.ts    POST /api/event -> Analytics Engine
worker/src/stats.ts     GET /api/admin/stats -> Analytics Engine SQL API
src/views/              Home, CollectionView (/:slug), WorldGallery, admin/AdminView
src/components/admin/   Upload, media grid, collections, stats panels
src/composables/        useCollections (nav), useTracking (analytics)
```
