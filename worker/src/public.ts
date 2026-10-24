import { Hono } from "hono";
import type { AppEnv, MediaRow } from "./types";
import { SLUG_RE, toApiMedia } from "./util";

export const publicRoutes = new Hono<AppEnv>();

// Always revalidate: edits in /admin must show up on the next page load. The
// queries are tiny; freshness matters more than caching here.
const LIST_CACHE = "no-cache";

publicRoutes.get("/api/collections", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT c.slug, c.title,
            COALESCE(SUM(CASE WHEN m.type = 'image' AND m.published = 1 THEN 1 ELSE 0 END), 0) AS images,
            COALESCE(SUM(CASE WHEN m.type = 'video' AND m.published = 1 THEN 1 ELSE 0 END), 0) AS videos
       FROM collections c
       LEFT JOIN media m ON m.collection = c.slug
      WHERE c.published = 1
      GROUP BY c.slug
      ORDER BY c.position, c.title`,
  ).all<{ slug: string; title: string; images: number; videos: number }>();

  const featured = await c.env.DB.prepare(
    `SELECT COUNT(*) AS n
       FROM media m JOIN collections c ON c.slug = m.collection
      WHERE m.featured = 1 AND m.published = 1 AND c.published = 1 AND m.type = 'image'`,
  ).first<{ n: number }>();

  c.header("Cache-Control", LIST_CACHE);
  return c.json({ collections: results, featuredCount: featured?.n ?? 0 });
});

publicRoutes.get("/api/media", async (c) => {
  const collection = c.req.query("collection");
  const featured = c.req.query("featured") === "1";

  let sql = `SELECT m.* FROM media m JOIN collections c ON c.slug = m.collection
              WHERE m.published = 1 AND c.published = 1`;
  const binds: unknown[] = [];

  if (featured) {
    sql += " AND m.featured = 1";
  } else if (collection && SLUG_RE.test(collection)) {
    sql += " AND m.collection = ?";
    binds.push(collection);
  } else {
    return c.json({ error: "Provide ?collection=<slug> or ?featured=1" }, 400);
  }
  sql += " ORDER BY c.position, m.position, m.created_at LIMIT 500";

  const { results } = await c.env.DB.prepare(sql)
    .bind(...binds)
    .all<MediaRow>();

  c.header("Cache-Control", LIST_CACHE);
  return c.json({ media: results.map(toApiMedia) });
});

// ---- R2 file serving (images + range-capable video) ---------------------

const KEY_RE = /^[a-f0-9]{12}\/(main|small|poster)\.(webp|jpg|mp4|webm)$/;

function parseRange(range: R2Range, size: number) {
  let start: number;
  let end: number;
  if ("suffix" in range && range.suffix !== undefined) {
    start = Math.max(0, size - range.suffix);
    end = size - 1;
  } else {
    const r = range as { offset?: number; length?: number };
    start = r.offset ?? 0;
    end = r.length !== undefined ? start + r.length - 1 : size - 1;
  }
  return { start, end };
}

publicRoutes.get("/m/*", async (c) => {
  const key = decodeURIComponent(c.req.path.slice(3));
  if (!KEY_RE.test(key)) return c.notFound();

  const isRange = c.req.header("Range") !== undefined;

  const obj = await c.env.MEDIA.get(key, {
    range: c.req.raw.headers,
    onlyIf: c.req.raw.headers,
  });
  if (!obj) return c.notFound();

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("ETag", obj.httpEtag);
  headers.set("Accept-Ranges", "bytes");
  // Keys are per-upload (random id), so content never changes in place.
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  if (!("body" in obj)) {
    return new Response(null, { status: 304, headers });
  }

  let status = 200;
  if (isRange && obj.range) {
    const { start, end } = parseRange(obj.range, obj.size);
    headers.set("Content-Range", `bytes ${start}-${end}/${obj.size}`);
    headers.set("Content-Length", String(end - start + 1));
    status = 206;
  } else {
    headers.set("Content-Length", String(obj.size));
  }

  // No edge Cache API on purpose: a cached copy would outlive an admin delete.
  // Browsers cache via the immutable header; R2 reads are cheap.
  return new Response(obj.body, { status, headers });
});
