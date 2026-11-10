import { Hono } from "hono";
import type { AppEnv, MediaRow } from "./types";
import { SLUG_RE, VARIANT_WIDTHS, toApiMedia, variantUrl } from "./util";

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
// The Infinite Azure page's own media (background loop, poster, music): fixed names, so they may be replaced in place.
const AZURE_RE = /^azure\/[a-z0-9-]+\.(jpg|mp4|m4a|mp3|wav)$/;

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

// Originals-first images: /m/<id>/w<width>.webp is generated from <id>/orig.* on first
// request (Cloudflare Images binding) and cached in R2 under its own key.
const VARIANT_RE = new RegExp(`^([a-f0-9]{12})/w(${VARIANT_WIDTHS.join("|")})\\.webp$`);

const IMMUTABLE = "public, max-age=31536000, immutable";

function variantResponse(obj: R2Object | R2ObjectBody, cacheControl = IMMUTABLE) {
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set("ETag", obj.httpEtag);
  headers.set("Cache-Control", cacheControl);
  if (!("body" in obj)) return new Response(null, { status: 304, headers });
  headers.set("Content-Length", String(obj.size));
  return new Response(obj.body, { headers });
}

/** Sized copies of a photograph that belong to another rev than `rev`: copies of a file that has since been replaced. Removed once the current one exists. */
async function dropOtherRevs(media: R2Bucket, id: string, rev: number) {
  const { objects } = await media.list({ prefix: `${id}/w` });
  const old = objects
    .map((o) => ({ key: o.key, m: /\/w\d+(?:-r(\d+))?\.webp$/.exec(o.key) }))
    .filter(({ m }) => m && Number(m[1] ?? 1) !== rev)
    .map(({ key }) => key);
  if (old.length) await media.delete(old);
}

// Every other stored JPEG (a clip's poster frame, an older browser-resized photograph, the Azure page's poster) is handed out as WebP too:
// /m/<id>/poster.webp is made from the poster.jpg beside it on first request and kept in R2 under that name, so it does not matter which
// way the JPEG got into storage (the admin, the video watcher or the library publish script, which writes to R2 directly).
const WEBP_COPY_RE = /^(?:[a-f0-9]{12}\/(?:main|small|poster)|azure\/[a-z0-9-]+)\.webp$/;

async function webpCopy(env: AppEnv["Bindings"], key: string, conditions: Headers, cacheControl: string) {
  const [cached, src] = await Promise.all([
    env.MEDIA.get(key, { onlyIf: conditions }),
    env.MEDIA.head(key.replace(/\.webp$/, ".jpg")),
  ]);
  if (!src) return null; // no JPEG beside it: a file uploaded as WebP (or nothing at all), which the plain route below answers
  // the copy remembers which JPEG it was made from, so a JPEG replaced under the same name (the Azure poster) gets a new copy
  if (cached?.customMetadata?.from === src.etag) return { response: variantResponse(cached, cacheControl) };

  const jpeg = await env.MEDIA.get(src.key);
  if (!jpeg) return null;
  const out = await env.IMAGES.input(jpeg.body)
    .transform({ width: 2400, fit: "scale-down" })
    .output({ format: "image/webp", quality: 82 });
  const body = await out.response().arrayBuffer();
  return {
    response: new Response(body, {
      headers: { "Content-Type": "image/webp", "Content-Length": String(body.byteLength), "Cache-Control": cacheControl },
    }),
    keep: env.MEDIA.put(key, body, { httpMetadata: { contentType: "image/webp" }, customMetadata: { from: src.etag } }),
  };
}

publicRoutes.get("/m/*", async (c) => {
  const key = decodeURIComponent(c.req.path.slice(3));

  const v = VARIANT_RE.exec(key);
  if (v) {
    const [, id, w] = v;
    // a replaced photograph is asked for as ?r=<rev>: its sized copies are cached under their own keys, so the old ones are never reused
    const q = c.req.query("r");
    const rev = q && /^\d{1,3}$/.test(q) ? Number(q) : 1;
    const cacheKey = rev > 1 ? `${id}/w${w}-r${rev}.webp` : key;
    const cached = await c.env.MEDIA.get(cacheKey, { onlyIf: c.req.raw.headers });
    if (cached) return variantResponse(cached);

    // Not made yet. Only a photograph's current rev is made and kept: an address that carries another rev (a page held in a cache, an old
    // link) is sent on to the current one, so a copy of the file as it is now is never stored under an old rev's name.
    const row = await c.env.DB.prepare("SELECT rev FROM media WHERE id = ?").bind(id).first<{ rev: number | null }>();
    if (row && (row.rev ?? 1) !== rev) return c.redirect(variantUrl(id, Number(w), row.rev ?? 1), 302);

    const found = await c.env.MEDIA.list({ prefix: `${id}/orig.`, limit: 1 });
    const origKey = found.objects[0]?.key;
    const orig = origKey ? await c.env.MEDIA.get(origKey) : null;
    if (!orig) return c.notFound();

    const width = Number(w);
    const out = await c.env.IMAGES.input(orig.body)
      .transform({ width, fit: "scale-down" })
      .output({ format: "image/webp", quality: width >= 1440 ? 85 : 80 });
    const body = await out.response().arrayBuffer();
    c.executionCtx.waitUntil(
      c.env.MEDIA.put(cacheKey, body, { httpMetadata: { contentType: "image/webp" } })
        // the sized copies of the file this one replaced go, now that the page has the new one
        .then(() => (row ? dropOtherRevs(c.env.MEDIA, id, rev) : undefined)),
    );
    return new Response(body, {
      headers: {
        "Content-Type": "image/webp",
        "Content-Length": String(body.byteLength),
        "Cache-Control": IMMUTABLE,
      },
    });
  }

  // The azure files keep their names (they may be replaced in place): a day, then revalidate. Everything else never changes under its name.
  const cacheControl = key.startsWith("azure/") ? "public, max-age=86400" : IMMUTABLE;

  if (WEBP_COPY_RE.test(key)) {
    const copy = await webpCopy(c.env, key, c.req.raw.headers, cacheControl);
    if (copy) {
      if (copy.keep) c.executionCtx.waitUntil(copy.keep);
      return copy.response;
    }
  }
  if (!AZURE_RE.test(key) && !KEY_RE.test(key)) return c.notFound();

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
  headers.set("Cache-Control", cacheControl);

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
