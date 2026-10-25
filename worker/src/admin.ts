import { Hono } from "hono";
import { requireAdmin } from "./auth";
import { EMPTY_META, metaFromRaw, readMeta, type PhotoMeta } from "./ingest";
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

// ---- Multipart uploads (any file size) -----------------------------------
// The browser sends a file in <=PART_SIZE chunks, each a normal request well under the
// Worker body limit; the Worker forwards each chunk to an R2 multipart upload. Images keep
// their original (<id>/orig.<ext>); sized variants are generated later on demand.

const PART_SIZE = 16 * 1024 * 1024; // R2 parts must be >=5 MiB (except the last) and equal sized
const UPLOAD_TYPES: Record<string, { ext: string; kind: "image" | "video" }> = {
  "image/jpeg": { ext: "jpg", kind: "image" },
  "image/png": { ext: "png", kind: "image" },
  "image/webp": { ext: "webp", kind: "image" },
  "video/mp4": { ext: "mp4", kind: "video" },
  "video/webm": { ext: "webm", kind: "video" },
};
const MAX_ORIGINAL_IMAGE = 200 * 1024 * 1024;
const MAX_ORIGINAL_VIDEO = 2 * 1024 * 1024 * 1024;
const UPLOAD_KEY_RE = /^([a-f0-9]{12})\/(?:orig\.(?:jpg|png|webp)|main\.(?:mp4|webm))$/;

function uploadKey(c: { req: { param(n: string): string; query(n: string): string | undefined } }) {
  const id = c.req.param("id");
  const key = c.req.query("key") ?? "";
  const m = UPLOAD_KEY_RE.exec(key);
  return ID_RE.test(id) && m && m[1] === id ? key : null;
}

adminRoutes.post("/api/admin/uploads", async (c) => {
  const b = await c.req.json().catch(() => null);
  const type = UPLOAD_TYPES[String(b?.contentType)];
  if (!b || !type) return c.json({ error: `Unsupported content type: ${b?.contentType}` }, 415);
  if (typeof b.id !== "string" || !ID_RE.test(b.id)) return c.json({ error: "Bad id" }, 400);
  const size = Number(b.size);
  const max = type.kind === "image" ? MAX_ORIGINAL_IMAGE : MAX_ORIGINAL_VIDEO;
  if (!Number.isFinite(size) || size <= 0) return c.json({ error: "size required" }, 400);
  if (size > max) return c.json({ error: `File too large (max ${max / 1024 / 1024} MB)` }, 413);

  const key = `${b.id}/${type.kind === "image" ? "orig" : "main"}.${type.ext}`;
  const upload = await c.env.MEDIA.createMultipartUpload(key, {
    httpMetadata: { contentType: b.contentType },
  });
  return c.json({ key, uploadId: upload.uploadId, partSize: PART_SIZE });
});

adminRoutes.put("/api/admin/uploads/:id/parts/:n", async (c) => {
  const key = uploadKey(c);
  const uploadId = c.req.query("uploadId");
  const n = Number(c.req.param("n"));
  if (!key || !uploadId || !Number.isInteger(n) || n < 1 || n > 10000) {
    return c.json({ error: "Bad upload reference" }, 400);
  }
  const length = Number(c.req.header("Content-Length"));
  if (!Number.isFinite(length) || length <= 0 || length > PART_SIZE) {
    return c.json({ error: `Part must be 1 byte to ${PART_SIZE / 1024 / 1024} MiB` }, 413);
  }
  if (!c.req.raw.body) return c.json({ error: "Empty body" }, 400);

  const part = await c.env.MEDIA.resumeMultipartUpload(key, uploadId).uploadPart(n, c.req.raw.body);
  return c.json({ partNumber: part.partNumber, etag: part.etag });
});

adminRoutes.post("/api/admin/uploads/:id/complete", async (c) => {
  const key = uploadKey(c);
  const b = await c.req.json().catch(() => null);
  if (!key || !b || typeof b.uploadId !== "string" || !Array.isArray(b.parts) || !b.parts.length) {
    return c.json({ error: "Expected {uploadId, parts[]}" }, 400);
  }
  const parts = (b.parts as { partNumber: number; etag: string }[]).map((p) => ({
    partNumber: Number(p.partNumber),
    etag: String(p.etag),
  }));
  const obj = await c.env.MEDIA.resumeMultipartUpload(key, b.uploadId).complete(parts);
  const max = key.includes("/orig.") ? MAX_ORIGINAL_IMAGE : MAX_ORIGINAL_VIDEO;
  if (obj.size > max) {
    await c.env.MEDIA.delete(key);
    return c.json({ error: "File too large" }, 413);
  }
  return c.json({ key, size: obj.size });
});

adminRoutes.delete("/api/admin/uploads/:id", async (c) => {
  const key = uploadKey(c);
  const uploadId = c.req.query("uploadId");
  if (!key || !uploadId) return c.json({ error: "Bad upload reference" }, 400);
  await c.env.MEDIA.resumeMultipartUpload(key, uploadId).abort();
  return c.json({ ok: true });
});

// ---- Media ---------------------------------------------------------------

// Columns filled from the photo's own tags. Caption and place are handled separately (typed values win).
const META_SQL = `captured_at = ?, camera = ?, lens = ?, focal = ?, aperture = ?, iso = ?, shutter = ?,
  city = ?, region = ?, country = ?, country_code = ?, place_lat = ?, place_lon = ?,
  gps_lat = ?, gps_lon = ?, meta_read_at = datetime('now')`;
const metaBinds = (m: PhotoMeta) => [
  m.capturedAt, m.camera, m.lens, m.focal, m.aperture, m.iso, m.shutter,
  m.city, m.region, m.country, m.countryCode, m.placeLat, m.placeLon,
  m.gpsLat, m.gpsLon,
];

/** Videos carry no readable EXIF here, so the uploader (the video watcher) sends what the clip recorded:
 *  `{ capturedAt: "2023-05-12T12:02:11", lat, lon }`. The place is derived exactly like a photo's GPS place. */
function videoMeta(h: unknown): PhotoMeta | null {
  if (!h || typeof h !== "object") return null;
  const m = h as { capturedAt?: unknown; lat?: unknown; lon?: unknown };
  const at = typeof m.capturedAt === "string" ? /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)/.exec(m.capturedAt) : null;
  const lat = typeof m.lat === "number" ? m.lat : undefined;
  const lon = typeof m.lon === "number" ? m.lon : undefined;
  if (!at && lat === undefined) return null;
  return metaFromRaw({
    DateTimeOriginal: at ? `${at[1]}:${at[2]}:${at[3]} ${at[4]}:${at[5]}:${at[6]}` : undefined,
    latitude: lat,
    longitude: lon,
  });
}

/** Read the stored original's tags; a photo with unreadable metadata just yields empty values. */
async function metaOf(c: { env: { MEDIA: R2Bucket } }, key: string | null): Promise<PhotoMeta | null> {
  if (!key) return null;
  try {
    return await readMeta(c.env.MEDIA, key);
  } catch {
    return null;
  }
}

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
  // Originals-first images: the file was uploaded as <id>/orig.<ext> and has no main/small.
  const original: string | null = b.keys?.original ?? null;
  if (original !== null) {
    if (b.type !== "image" || typeof original !== "string" || !new RegExp(`^${id}/orig\\.(jpg|png|webp)$`).test(original)) {
      return c.json({ error: "Bad key for original" }, 400);
    }
    if (!(await c.env.MEDIA.head(original))) return c.json({ error: "original not uploaded" }, 400);
    keys.main = original; // key_main is NOT NULL and doubles as the thing to delete
    keys.small = null;
  }
  if (!keys.main) return c.json({ error: "keys.main or keys.original required" }, 400);
  let sizeBytes = 0;
  for (const [role, key] of Object.entries(keys) as [Role, string | null][]) {
    if (!key) continue;
    if (original !== null && role === "main") {
      sizeBytes = (await c.env.MEDIA.head(original))!.size;
      continue;
    }
    if (typeof key !== "string" || !keyRe.test(key) || !key.includes(`/${role}.`)) {
      return c.json({ error: `Bad key for ${role}` }, 400);
    }
    const head = await c.env.MEDIA.head(key);
    if (!head) return c.json({ error: `${role} not uploaded` }, 400);
    if (role === "main") sizeBytes = head.size;
  }

  const position = await nextPosition(c.env.DB, b.collection);
  // Fill caption and place from the photo's own tags when they were left blank; anything typed wins.
  const meta = b.type === "image" ? await metaOf(c, original) : videoMeta(b.meta);
  const typedCaption = caption.trim() !== "";
  const typedPlace = place.trim() !== "";
  const finalCaption = typedCaption ? caption : (meta?.caption ?? "");
  const finalPlace = typedPlace ? place : (meta?.place ?? "");
  const captionSource = typedCaption ? "manual" : meta?.caption ? "photo" : "";
  const placeSource = typedPlace ? "manual" : meta?.place ? meta.placeSource : "";
  const insert = c.env.DB.prepare(
    `INSERT INTO media (id, collection, type, caption, place, orientation, width, height,
                        position, published, featured, key_main, key_small, key_poster, size_bytes,
                        key_original)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(
      id,
      b.collection,
      b.type,
      finalCaption,
      finalPlace,
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
      original,
    );
  await c.env.DB.batch([
    insert,
    c.env.DB.prepare(`UPDATE media SET ${META_SQL}, caption_source = ?, place_source = ? WHERE id = ?`).bind(
      ...metaBinds(meta ?? EMPTY_META),
      captionSource,
      placeSource,
      id,
    ),
  ]);

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
    set("caption_source", b.caption.trim() ? "manual" : "");
  }
  if (b.place !== undefined) {
    if (!isString(b.place, 200)) return c.json({ error: "Place too long" }, 400);
    set("place", b.place);
    set("place_source", b.place.trim() ? "manual" : "");
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

// Re-read the tags from the stored original (for photos uploaded before this existed, or after the reader improved).
// Caption and place are refreshed unless a person typed them; `{"overwrite": true}` replaces those too.
adminRoutes.post("/api/admin/media/:id/read-metadata", async (c) => {
  const id = c.req.param("id");
  const b = (await c.req.json().catch(() => null)) ?? {};
  const row = await c.env.DB.prepare("SELECT * FROM media WHERE id = ?").bind(id).first<MediaRow>();
  if (!row) return c.json({ error: "Not found" }, 404);
  if (!row.key_original) return c.json({ error: "No original stored for this item" }, 409);
  const meta = await metaOf(c, row.key_original);
  if (!meta) return c.json({ error: "Could not read the original" }, 502);

  const overwrite = b.overwrite === true;
  const captionOpen = overwrite || row.caption_source !== "manual";
  const placeOpen = overwrite || row.place_source !== "manual";
  // never blank out something that is already there when the photo has nothing to say
  const caption = captionOpen && meta.caption ? meta.caption : row.caption;
  const place = placeOpen && meta.place ? meta.place : row.place;
  const captionSource = captionOpen && meta.caption ? "photo" : row.caption_source;
  const placeSource = placeOpen && meta.place ? meta.placeSource : row.place_source;
  await c.env.DB.prepare(
    `UPDATE media SET ${META_SQL}, caption = ?, place = ?, caption_source = ?, place_source = ?, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(...metaBinds(meta), caption, place, captionSource, placeSource, id)
    .run();
  const out = await c.env.DB.prepare("SELECT * FROM media WHERE id = ?").bind(id).first<MediaRow>();
  return c.json({ media: toApiMedia(out!) });
});

adminRoutes.delete("/api/admin/media/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT * FROM media WHERE id = ?")
    .bind(id)
    .first<MediaRow>();
  if (!row) return c.json({ error: "Not found" }, 404);

  const keys = new Set(
    [row.key_main, row.key_small, row.key_poster, row.key_original].filter((k): k is string => !!k),
  );
  // Also sweep generated variants (<id>/w<width>.webp) and anything else under the prefix.
  let cursor: string | undefined;
  do {
    const page = await c.env.MEDIA.list({ prefix: `${id}/`, cursor });
    page.objects.forEach((o) => keys.add(o.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  await c.env.MEDIA.delete([...keys]);
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
