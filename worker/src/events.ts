import { Hono } from "hono";
import type { AppEnv } from "./types";

export const eventRoutes = new Hono<AppEnv>();

// Column layout in Analytics Engine (keep in sync with stats.ts):
//   index1 = id or path        blob1 = type        blob2 = media id
//   blob3 = collection         blob4 = path        blob5 = country
//   blob6 = device             blob7 = referrer host
//   double1 = value (progress %, dwell ms, ...)
export const EVENT_TYPES = new Set([
  "page_view",
  "media_view",
  "video_play",
  "video_progress",
]);

const SAFE = /^[\w./-]{0,100}$/;
const BOT_RE = /bot|crawl|spider|slurp|preview|headless|lighthouse/i;

const clean = (v: unknown) => (typeof v === "string" && SAFE.test(v) ? v : "");

eventRoutes.post("/api/event", async (c) => {
  const ua = c.req.header("User-Agent") ?? "";
  if (BOT_RE.test(ua)) return c.body(null, 204);

  const body = await c.req.json().catch(() => null);
  if (!body || typeof body !== "object") return c.body(null, 400);

  const type = clean(body.type);
  if (!EVENT_TYPES.has(type)) return c.body(null, 400);

  const id = clean(body.id);
  const collection = clean(body.collection);
  const path = clean(body.path) || "/";
  const value =
    typeof body.value === "number" && Number.isFinite(body.value)
      ? Math.min(Math.max(body.value, 0), 1e7)
      : 0;
  const device = body.mobile === true ? "mobile" : "desktop";

  // Same-origin beacons always carry our own Referer, so the client sends
  // document.referrer's host in the body instead.
  const own = new URL(c.req.url).host;
  const refHost = clean(body.referrer);
  const referrer = refHost && refHost !== own ? refHost : "";

  const country = (c.req.raw as Request & { cf?: { country?: string } }).cf?.country ?? "";

  // The public view counter: one more for every real page view (bots were dropped above, /admin is never sent).
  if (type === "page_view") {
    c.executionCtx.waitUntil(
      c.env.DB.prepare("INSERT INTO counters (name, n) VALUES ('views', 1) ON CONFLICT(name) DO UPDATE SET n = n + 1")
        .run()
        .catch(() => {}), // a counting problem must never break a page
    );
  }

  c.env.EVENTS?.writeDataPoint({
    indexes: [(id || path).slice(0, 96)],
    blobs: [type, id, collection, path, country, device, referrer],
    doubles: [value],
  });

  return c.body(null, 204);
});

// The number shown at the bottom right of every page. Cheap (one row) and cached for a few seconds at the edge.
eventRoutes.get("/api/views", async (c) => {
  const row = await c.env.DB.prepare("SELECT n FROM counters WHERE name = 'views'")
    .first<{ n: number }>()
    .catch(() => null);
  c.header("Cache-Control", "public, max-age=10");
  return c.json({ views: row?.n ?? null });
});
