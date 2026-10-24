import { Hono } from "hono";
import { requireAdmin } from "./auth";
import type { AppEnv, CollectionRow, MediaRow } from "./types";
import {
  ID_RE,
  RESERVED_SLUGS,
  SLUG_RE,
  intOr,
  isString,
  toApiMedia,
} from "./util";

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use("/api/admin/*", requireAdmin);
adminRoutes.use("/api/admin/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});

adminRoutes.get("/api/admin/me", (c) => c.json({ email: c.get("adminEmail") }));

// ---- Uploads -------------------------------------------------------------

type Role = "main" | "small" | "poster";
const EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "video/mp4": "mp4",
  "video/webm": "webm",
};
const MAX_IMAGE = 25 * 1024 * 1024;
const MAX_VIDEO = 100 * 1024 * 1024; // Workers request-body limit on Free/Pro

const KEY_FOR = (id: string) =>
  new RegExp(`^${id}/(main|small|poster)\\.(webp|jpg|mp4|webm)$`);

adminRoutes.put("/api/admin/upload/:id/:role", async (c) => {
  const id = c.req.param("id");
  const role = c.req.param("role") as Role;
  if (!ID_RE.test(id) || !["main", "small", "poster"].includes(role)) {
    return c.json({ error: "Bad id or role" }, 400);
  }

  const contentType = (c.req.header("Content-Type") ?? "").split(";")[0].trim();
  const ext = EXT[contentType];
  const isVideo = contentType.startsWith("video/");
  if (!ext || (isVideo && role !== "main")) {
    return c.json({ error: `Unsupported content type: ${contentType}` }, 415);
  }

  const length = Number(c.req.header("Content-Length"));
  const max = isVideo ? MAX_VIDEO : MAX_IMAGE;
  if (!Number.isFinite(length) || length <= 0) {
    return c.json({ error: "Content-Length required" }, 411);
  }
  if (length > max) {
    return c.json({ error: `File too large (max ${max / 1024 / 1024}MB)` }, 413);
  }
  if (!c.req.raw.body) return c.json({ error: "Empty body" }, 400);

  const key = `${id}/${role}.${ext}`;
  const obj = await c.env.MEDIA.put(key, c.req.raw.body, {
    httpMetadata: { contentType },
  });
  if (obj.size > max) {
    await c.env.MEDIA.delete(key);
    return c.json({ error: "File too large" }, 413);
  }
  return c.json({ key, size: obj.size });
});

// ---- Media ---------------------------------------------------------------

adminRoutes.get("/api/admin/media", async (c) => {
  const collection = c.req.query("collection");
  const stmt = collection
    ? c.env.DB.prepare(
        "SELECT * FROM media WHERE collection = ? ORDER BY position, created_at",
      ).bind(collection)
    : c.env.DB.prepare(
        "SELECT m.* FROM media m JOIN collections c ON c.slug = m.collection ORDER BY c.position, m.position, m.created_at",
      );
  const { results } = await stmt.all<MediaRow>();
  return c.json({ media: results.map(toApiMedia) });
});

async function nextPosition(db: D1Database, collection: string) {
  const row = await db
    .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS p FROM media WHERE collection = ?")
    .bind(collection)
    .first<{ p: number }>();
  return row?.p ?? 0;
}

adminRoutes.post("/api/admin/media", async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b) return c.json({ error: "Invalid JSON" }, 400);

  const id = b.id;
  if (typeof id !== "string" || !ID_RE.test(id)) return c.json({ error: "Bad id" }, 400);
  if (b.type !== "image" && b.type !== "video") return c.json({ error: "Bad type" }, 400);
  if (!isString(b.collection, 40)) return c.json({ error: "Bad collection" }, 400);
  const caption = b.caption === undefined ? "" : b.caption;
  const place = b.place === undefined ? "" : b.place;
  if (!isString(caption, 2000) || !isString(place, 200)) {
    return c.json({ error: "Caption/place too long" }, 400);
  }
  const orientation = ["landscape", "portrait", "unknown"].includes(b.orientation)
    ? b.orientation
    : "unknown";

  const col = await c.env.DB.prepare("SELECT slug FROM collections WHERE slug = ?")
    .bind(b.collection)
    .first();
  if (!col) return c.json({ error: "Unknown collection" }, 400);

  // Every referenced key must belong to this id and already exist in R2.
  const keyRe = KEY_FOR(id);
  const keys: Record<Role, string | null> = {
    main: b.keys?.main ?? null,
    small: b.keys?.small ?? null,
    poster: b.keys?.poster ?? null,
  };
  if (!keys.main) return c.json({ error: "keys.main required" }, 400);
  let sizeBytes = 0;
  for (const [role, key] of Object.entries(keys) as [Role, string | null][]) {
    if (!key) continue;
    if (typeof key !== "string" || !keyRe.test(key) || !key.includes(`/${role}.`)) {
      return c.json({ error: `Bad key for ${role}` }, 400);
    }
    const head = await c.env.MEDIA.head(key);
    if (!head) return c.json({ error: `${role} not uploaded` }, 400);
    if (role === "main") sizeBytes = head.size;
  }

  const position = await nextPosition(c.env.DB, b.collection);
  await c.env.DB.prepare(
    `INSERT INTO media (id, collection, type, caption, place, orientation, width, height,
                        position, published, featured, key_main, key_small, key_poster, size_bytes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      b.collection,
      b.type,
      caption,
      place,
      orientation,
      Math.max(0, intOr(b.width, 0)),
      Math.max(0, intOr(b.height, 0)),
      position,
      b.published === false ? 0 : 1,
      b.featured === true ? 1 : 0,
      keys.main,
      keys.small,
      keys.poster,
      sizeBytes,
    )
    .run();

  const row = await c.env.DB.prepare("SELECT * FROM media WHERE id = ?")
    .bind(id)
    .first<MediaRow>();
  return c.json({ media: toApiMedia(row!) }, 201);
});

adminRoutes.patch("/api/admin/media/:id", async (c) => {
  const id = c.req.param("id");
  const b = await c.req.json().catch(() => null);
  if (!b) return c.json({ error: "Invalid JSON" }, 400);

  const existing = await c.env.DB.prepare("SELECT * FROM media WHERE id = ?")
    .bind(id)
    .first<MediaRow>();
  if (!existing) return c.json({ error: "Not found" }, 404);

  const sets: string[] = [];
  const binds: unknown[] = [];
  const set = (col: string, val: unknown) => {
    sets.push(`${col} = ?`);
    binds.push(val);
  };

  if (b.caption !== undefined) {
    if (!isString(b.caption, 2000)) return c.json({ error: "Caption too long" }, 400);
    set("caption", b.caption);
  }
  if (b.place !== undefined) {
    if (!isString(b.place, 200)) return c.json({ error: "Place too long" }, 400);
    set("place", b.place);
  }
  if (b.orientation !== undefined) {
    if (!["landscape", "portrait", "unknown"].includes(b.orientation)) {
      return c.json({ error: "Bad orientation" }, 400);
    }
    set("orientation", b.orientation);
  }
  if (b.published !== undefined) set("published", b.published ? 1 : 0);
  if (b.featured !== undefined) set("featured", b.featured ? 1 : 0);
  if (b.collection !== undefined && b.collection !== existing.collection) {
    const col = await c.env.DB.prepare("SELECT slug FROM collections WHERE slug = ?")
      .bind(b.collection)
      .first();
    if (!col) return c.json({ error: "Unknown collection" }, 400);
    set("collection", b.collection);
    set("position", await nextPosition(c.env.DB, b.collection));
  }

  if (sets.length) {
    sets.push("updated_at = datetime('now')");
    await c.env.DB.prepare(`UPDATE media SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...binds, id)
      .run();
  }
  const row = await c.env.DB.prepare("SELECT * FROM media WHERE id = ?")
    .bind(id)
    .first<MediaRow>();
  return c.json({ media: toApiMedia(row!) });
});

adminRoutes.delete("/api/admin/media/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT * FROM media WHERE id = ?")
    .bind(id)
    .first<MediaRow>();
  if (!row) return c.json({ error: "Not found" }, 404);

  const keys = [row.key_main, row.key_small, row.key_poster].filter(
    (k): k is string => !!k,
  );
  await c.env.MEDIA.delete(keys);
  await c.env.DB.prepare("DELETE FROM media WHERE id = ?").bind(id).run();
  return c.json({ ok: true });
});

adminRoutes.put("/api/admin/media-order", async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b || !isString(b.collection, 40) || !Array.isArray(b.ids) || b.ids.length > 500) {
    return c.json({ error: "Expected {collection, ids[]}" }, 400);
  }
  const { results } = await c.env.DB.prepare(
    "SELECT id FROM media WHERE collection = ?",
  )
    .bind(b.collection)
    .all<{ id: string }>();
  const known = new Set(results.map((r) => r.id));
  if (b.ids.some((i: unknown) => typeof i !== "string" || !known.has(i))) {
    return c.json({ error: "ids must all belong to the collection" }, 400);
  }
  await c.env.DB.batch(
    (b.ids as string[]).map((id, i) =>
      c.env.DB.prepare("UPDATE media SET position = ? WHERE id = ?").bind(i, id),
    ),
  );
  return c.json({ ok: true });
});

// ---- Collections ---------------------------------------------------------

adminRoutes.get("/api/admin/collections", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT c.slug, c.title, c.position, c.published, COUNT(m.id) AS count
       FROM collections c LEFT JOIN media m ON m.collection = c.slug
      GROUP BY c.slug ORDER BY c.position, c.title`,
  ).all<CollectionRow & { count: number }>();
  return c.json({
    collections: results.map((r) => ({ ...r, published: !!r.published })),
  });
});

adminRoutes.post("/api/admin/collections", async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b || !isString(b.title, 80) || !b.title.trim()) {
    return c.json({ error: "Title required" }, 400);
  }
  const slug = b.slug ?? b.title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (typeof slug !== "string" || !SLUG_RE.test(slug) || RESERVED_SLUGS.has(slug)) {
    return c.json({ error: "Invalid or reserved slug" }, 400);
  }
  const exists = await c.env.DB.prepare("SELECT 1 FROM collections WHERE slug = ?")
    .bind(slug)
    .first();
  if (exists) return c.json({ error: "Slug already exists" }, 409);

  const pos = await c.env.DB.prepare(
    "SELECT COALESCE(MAX(position), -1) + 1 AS p FROM collections",
  ).first<{ p: number }>();
  await c.env.DB.prepare(
    "INSERT INTO collections (slug, title, position) VALUES (?, ?, ?)",
  )
    .bind(slug, b.title.trim(), pos?.p ?? 0)
    .run();
  return c.json({ slug }, 201);
});

adminRoutes.patch("/api/admin/collections/:slug", async (c) => {
  const slug = c.req.param("slug");
  const b = await c.req.json().catch(() => null);
  if (!b) return c.json({ error: "Invalid JSON" }, 400);

  const sets: string[] = [];
  const binds: unknown[] = [];
  if (b.title !== undefined) {
    if (!isString(b.title, 80) || !b.title.trim()) return c.json({ error: "Bad title" }, 400);
    sets.push("title = ?");
    binds.push(b.title.trim());
  }
  if (b.published !== undefined) {
    sets.push("published = ?");
    binds.push(b.published ? 1 : 0);
  }
  if (!sets.length) return c.json({ error: "Nothing to update" }, 400);

  const res = await c.env.DB.prepare(
    `UPDATE collections SET ${sets.join(", ")} WHERE slug = ?`,
  )
    .bind(...binds, slug)
    .run();
  if (!res.meta.changes) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
});

adminRoutes.delete("/api/admin/collections/:slug", async (c) => {
  const slug = c.req.param("slug");
  const n = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM media WHERE collection = ?")
    .bind(slug)
    .first<{ n: number }>();
  if (n && n.n > 0) {
    return c.json({ error: "Collection still has media; move or delete it first" }, 409);
  }
  await c.env.DB.prepare("DELETE FROM collections WHERE slug = ?").bind(slug).run();
  return c.json({ ok: true });
});

adminRoutes.put("/api/admin/collection-order", async (c) => {
  const b = await c.req.json().catch(() => null);
  if (!b || !Array.isArray(b.slugs) || b.slugs.length > 100) {
    return c.json({ error: "Expected {slugs[]}" }, 400);
  }
  await c.env.DB.batch(
    (b.slugs as string[]).map((s, i) =>
      c.env.DB.prepare("UPDATE collections SET position = ? WHERE slug = ?").bind(i, s),
    ),
  );
  return c.json({ ok: true });
});
