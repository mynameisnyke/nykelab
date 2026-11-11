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

// Only journal posts get a counter of their own: "/journal/<slug>", with or without a trailing slash.
const POST_RE = /^\/journal\/[a-z0-9][a-z0-9-]{0,80}$/;
export const postPath = (path: string) => {
  const p = path.replace(/\/$/, "");
  return POST_RE.test(p) ? p : "";
};

const bump = (db: D1Database, name: string) =>
  db.prepare("INSERT INTO counters (name, n) VALUES (?, 1) ON CONFLICT(name) DO UPDATE SET n = n + 1").bind(name);

// Unique visitors per day, with no cookie and nothing kept that identifies anyone (migrations/0008_visitors.sql):
// the first page view of the day from a given IP address + browser adds one to 'visitors' (and, on a post, to
// 'visitors:/journal/<slug>'). Yesterday's salt and hashes are deleted on the way.
async function countVisitor(db: D1Database, post: string, ip: string, ua: string) {
  const day = new Date().toISOString().slice(0, 10);
  const setup = await db.batch<{ salt: string }>([
    db.prepare("DELETE FROM visits WHERE day < ?").bind(day),
    db.prepare("DELETE FROM visit_days WHERE day < ?").bind(day),
    db.prepare("INSERT OR IGNORE INTO visit_days (day, salt) VALUES (?, ?)").bind(day, crypto.randomUUID()),
    db.prepare("SELECT salt FROM visit_days WHERE day = ?").bind(day),
  ]);
  const salt = setup[3].results[0]?.salt;
  if (!salt) return;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}|${ip}|${ua}`));
  const visitor = [...new Uint8Array(digest).slice(0, 16)].map((b) => b.toString(16).padStart(2, "0")).join("");

  const scopes = post ? ["*", post] : ["*"];
  const seen = await db.batch(
    scopes.map((scope) => db.prepare("INSERT OR IGNORE INTO visits (day, path, visitor) VALUES (?, ?, ?)").bind(day, scope, visitor)),
  );
  const fresh = scopes.filter((_, i) => seen[i].meta.changes === 1);
  if (fresh.length) await db.batch(fresh.map((scope) => bump(db, scope === "*" ? "visitors" : `visitors:${scope}`)));
}

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

  // The public view counters: one more for every real page view (bots were dropped above, /admin is never sent).
  // The site total is the row 'views'; a journal post also gets its own row, 'views:/journal/<slug>'.
  if (type === "page_view") {
    const db = c.env.DB;
    const post = postPath(path);
    const ip = c.req.header("CF-Connecting-IP") ?? "";
    c.executionCtx.waitUntil(
      Promise.all([
        db.batch(post ? [bump(db, "views"), bump(db, `views:${post}`)] : [bump(db, "views")]),
        countVisitor(db, post, ip, ua),
      ]).catch(() => {}), // a counting problem must never break a page
    );
  }

  c.env.EVENTS?.writeDataPoint({
    indexes: [(id || path).slice(0, 96)],
    blobs: [type, id, collection, path, country, device, referrer],
    doubles: [value],
  });

  return c.body(null, 204);
});

// The number shown at the bottom right of every page; with ?path=/journal/<slug>, that post's own count too (`page`).
// Cheap (one or two rows) and cached for a few seconds at the edge.
eventRoutes.get("/api/views", async (c) => {
  const post = postPath(c.req.query("path") ?? "");
  const names = post ? ["views", `views:${post}`] : ["views"];
  const rows = await c.env.DB.prepare(`SELECT name, n FROM counters WHERE name IN (${names.map(() => "?").join(", ")})`)
    .bind(...names)
    .all<{ name: string; n: number }>()
    .then((r) => r.results)
    .catch(() => null);
  const n = (name: string) => rows?.find((r) => r.name === name)?.n;
  c.header("Cache-Control", "public, max-age=10");
  return c.json({ views: n("views") ?? null, ...(post ? { page: rows ? (n(`views:${post}`) ?? 0) : null } : {}) });
});
