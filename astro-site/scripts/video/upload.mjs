// Sends a converted clip to the admin API exactly like the browser uploader does: chunked multipart upload of the
// video, a poster image, then the media row. Works against the local dev server (no login) or, with a Cloudflare
// Access service token in CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET, a deployed one.
import fs from "node:fs";
import { randomBytes } from "node:crypto";

const authHeaders = () =>
  process.env.CF_ACCESS_CLIENT_ID && process.env.CF_ACCESS_CLIENT_SECRET
    ? { "CF-Access-Client-Id": process.env.CF_ACCESS_CLIENT_ID, "CF-Access-Client-Secret": process.env.CF_ACCESS_CLIENT_SECRET }
    : {};

async function call(api, path, init = {}) {
  const res = await fetch(api + path, { ...init, headers: { ...authHeaders(), ...(init.headers ?? {}) }, redirect: "manual" });
  if (res.status >= 300 && res.status < 400) throw new Error(`${path}: redirected to a login page; set CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET`);
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  if (!res.ok) throw new Error(`${path}: ${res.status} ${typeof body === "object" ? body.error ?? JSON.stringify(body) : body.slice(0, 200)}`);
  return body;
}
const json = (method, data) => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });

export const slugify = (s) => s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "").trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export const titleCase = (s) => s.replace(/[-_]+/g, " ").replace(/\b\p{L}/gu, (c) => c.toUpperCase()).trim();
export const newId = () => randomBytes(6).toString("hex");

/** The collection for a folder name: reuse it when it exists, otherwise create it ("bogota" -> "Bogota", /bogota). */
export async function ensureCollection(api, folder) {
  const slug = slugify(folder);
  const { collections } = await call(api, "/api/admin/collections");
  if (collections.some((c) => c.slug === slug)) return slug;
  await call(api, "/api/admin/collections", json("POST", { title: titleCase(folder), slug }));
  return slug;
}

async function readChunk(file, start, length) {
  const fh = await fs.promises.open(file, "r");
  try {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await fh.read(buf, 0, length, start);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

/**
 * @param {{api:string, collection:string, video:string, poster:string, width:number, height:number,
 *          meta?: {capturedAt?: string|null, lat?: number, lon?: number}, publish?: boolean}} job
 * @returns the created media row
 */
export async function uploadVideo(job) {
  const { api, collection, video, poster } = job;
  const id = newId();
  const size = (await fs.promises.stat(video)).size;
  const init = await call(api, "/api/admin/uploads", json("POST", { id, contentType: "video/mp4", size }));
  const ref = `key=${encodeURIComponent(init.key)}`;
  const parts = [];
  try {
    for (let n = 1, offset = 0; offset < size; n++, offset += init.partSize) {
      const chunk = await readChunk(video, offset, Math.min(init.partSize, size - offset));
      parts.push(await call(api, `/api/admin/uploads/${id}/parts/${n}?${ref}&uploadId=${encodeURIComponent(init.uploadId)}`, { method: "PUT", body: chunk, headers: { "Content-Type": "application/octet-stream" } }));
    }
    await call(api, `/api/admin/uploads/${id}/complete?${ref}`, json("POST", { uploadId: init.uploadId, parts }));
  } catch (err) {
    await call(api, `/api/admin/uploads/${id}?${ref}&uploadId=${encodeURIComponent(init.uploadId)}`, { method: "DELETE" }).catch(() => {});
    throw err;
  }
  const posterBytes = await fs.promises.readFile(poster);
  const up = await call(api, `/api/admin/upload/${id}/poster`, { method: "PUT", body: posterBytes, headers: { "Content-Type": "image/jpeg" } });
  const { media } = await call(
    api,
    "/api/admin/media",
    json("POST", {
      id,
      collection,
      type: "video",
      width: job.width,
      height: job.height,
      orientation: job.height > job.width ? "portrait" : "landscape",
      published: job.publish !== false,
      keys: { main: init.key, poster: up.key },
      meta: job.meta ?? {},
    }),
  );
  return media;
}
