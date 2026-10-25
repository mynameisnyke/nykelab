#!/usr/bin/env node
// Publishes the graded media library (photos + clips) to the site: files to R2, rows to D1. Read-only on the library.
// See docs/library-publish-plan.md for the mapping rules.
//
//   node scripts/publish-library.mjs --dry-run                      show the plan, change nothing
//   node scripts/publish-library.mjs --target local --only bogota   try one collection against the dev server's storage
//   node scripts/publish-library.mjs --target remote                publish everything (resumable: rerun to continue)
//
// Resumable and idempotent: uploaded files are remembered in .publish-state/ (size + mtime) and skipped; media ids and
// storage keys derive from the manifest ids; rows are upserted. Nothing is ever deleted.
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

const { values: a } = parseArgs({
  options: {
    library: { type: "string", default: "/Volumes/Whiskey/resolve/LibraryGrade" },
    target: { type: "string", default: "local" },
    only: { type: "string" },
    approvals: { type: "string" },
    concurrency: { type: "string", default: "8" },
    "dry-run": { type: "boolean", default: false },
    bucket: { type: "string", default: "nykelab-media" },
    "position-base": { type: "string", default: "100" },
    "exclude-borderline": { type: "boolean", default: false },
  },
});
const LIB = a.library;
const remote = a.target === "remote";
const WR = ["wrangler"];
const where = remote ? ["--remote"] : ["--local", "--persist-to", ".wrangler/state"];
const log = (...m) => console.log(new Date().toTimeString().slice(0, 8), ...m);

// ---- helpers ---------------------------------------------------------------------------------------
const fold = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\(.*?\)/g, " ").replace(/[^a-z0-9]+/g, " ").trim();
const titleCase = (s) => (s === s.toLowerCase() ? s.replace(/\b\p{L}/gu, (c) => c.toUpperCase()) : s);
const sha = (s) => createHash("sha1").update(s).digest("hex").slice(0, 12);
const q = (s) => (s == null ? "NULL" : typeof s === "number" ? String(s) : `'${String(s).replace(/'/g, "''")}'`);

function sh(args, { input } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn("npx", [...WR, ...args], { stdio: ["pipe", "pipe", "pipe"] });
    let out = "", err = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (err += d));
    p.on("close", (code) => (code === 0 ? resolve(out) : reject(new Error(`wrangler ${args.slice(0, 3).join(" ")} failed (${code}): ${(err || out).slice(-300)}`))));
    if (input) p.stdin.end(input); else p.stdin.end();
  });
}

// ---- plan ------------------------------------------------------------------------------------------
const photosM = JSON.parse(fs.readFileSync(path.join(LIB, "photos/manifest.json"), "utf8"));
const clipsAll = JSON.parse(fs.readFileSync(path.join(LIB, "subclips/manifest.json"), "utf8"));

// Duplicate clips are hidden, never deleted: ids listed in excluded-clips.json (see scripts/build-excluded-clips.mjs)
// are left out when the manifest is loaded, and any earlier-published row for them is unpublished (files stay in R2).
// --exclude-borderline also hides the similar-but-not-identical list.
const excludedFile = JSON.parse(fs.readFileSync(new URL("../excluded-clips.json", import.meta.url), "utf8"));
const EXCLUDED = new Set([...excludedFile.excluded, ...(a["exclude-borderline"] ? excludedFile.borderline : [])]);
const clipsM = { ...clipsAll, subclips: clipsAll.subclips.filter((s) => !EXCLUDED.has(s.id)) };

/** approvals.json from the review page: tolerate a few shapes. {id: "V"|"T"|true}, [ids], or {approved:[...]} */
function readApprovals(file) {
  if (!file) return null;
  const j = JSON.parse(fs.readFileSync(file, "utf8"));
  const map = new Map();
  const add = (id, v) => map.set(String(id), /^t/i.test(String(v?.look ?? v)) ? "tmag" : "voyages");
  if (Array.isArray(j)) j.forEach((x) => (typeof x === "string" ? add(x, "V") : add(x.id, x.look ?? x.choice ?? "V")));
  else for (const [id, v] of Object.entries(j.approved ?? j)) if (v) add(id, v);
  return map;
}
const approvals = readApprovals(a.approvals);

// Clip folders the manifest pairs wrongly, found by looking at the footage (not the names):
//  - "New Mexico" and phoenix_2021 are the same Grand Canyon / Arizona-rim footage (18 clips each): both belong with the
//    grand_canyon stills, and excluded-clips.json decides which twin of each pair stays
//  - uk_2023 is the Brighton seafront in 2023, not the 2017 London trip the manifest links it to
const FOLDER_HOME = { "New Mexico": "grand_canyon", phoenix_2021: "grand_canyon", uk_2023: "brighton" };

function plan() {
  const only = a.only ? new Set(a.only.split(",")) : null;
  const cols = new Map();
  for (const p of photosM.photos) {
    const look = approvals ? approvals.get(p.id) : "voyages";
    if (!look) continue;
    const dir = p.id.split("/")[0];
    if (only && !only.has(dir)) continue;
    const c = cols.get(dir) ?? { dir, slug: dir.replace(/_/g, "-").toLowerCase(), title: titleCase(p.collection), name: p.collection, photos: [], clips: [], folders: p.video_folders, first: p.capture ?? "9999" };
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(c.slug)) throw new Error(`bad slug ${c.slug}`);
    c.photos.push({ ...p, use: p.looks[look], look });
    if (p.capture && p.capture < c.first) c.first = p.capture;
    cols.set(dir, c);
  }
  // each clip folder goes to exactly one of the collections that claim it: the best name match for the folder's place
  const claim = new Map();
  for (const c of cols.values()) for (const f of c.folders) claim.set(f, [...(claim.get(f) ?? []), c]);
  const primary = new Map();
  for (const [folder, cs] of claim) {
    const place = fold(clipsM.subclips.find((s) => s.folder === folder)?.place ?? folder);
    const ftoks = fold(folder).split(" ");
    const score = (c) => {
      const n = fold(c.name);
      return (n === place ? 100 : 0) + (n.startsWith(place) ? 50 : 0) + (n.includes(place) ? 25 : 0) + (ftoks.every((t) => n.includes(t)) ? 30 : 0) + c.photos.length / 100;
    };
    primary.set(folder, cs.sort((x, y) => score(y) - score(x))[0]);
  }
  for (const s of clipsM.subclips) {
    const c = s.folder in FOLDER_HOME ? cols.get(FOLDER_HOME[s.folder]) : primary.get(s.folder);
    if (c) c.clips.push(s);
  }
  // interleave: photos by rank, clips by quality, clips spread evenly, rank 1 stays first
  for (const c of cols.values()) {
    c.photos.sort((x, y) => x.rank - y.rank);
    c.clips.sort((x, y) => y.quality_score - x.quality_score);
    const P = c.photos.length, V = c.clips.length, n = P + V;
    const slotOf = new Set(Array.from({ length: V }, (_, j) => Math.max(P ? 1 : 0, Math.round(((j + 1) * n) / (V + 1)) - (P ? 0 : 1))));
    // resolve duplicate / out-of-range slots deterministically
    const slots = [];
    for (const s of [...slotOf].sort((x, y) => x - y)) slots.push(s);
    while (slots.length < V) slots.push(n - 1 - (V - slots.length - 1));
    const vs = new Set(slots.slice(0, V));
    let pi = 0, vi = 0;
    c.items = [];
    for (let i = 0; i < n; i++) {
      const item = vs.has(i) && vi < V ? { kind: "video", ...c.clips[vi++] } : pi < P ? { kind: "photo", ...c.photos[pi++] } : { kind: "video", ...c.clips[vi++] };
      c.items.push(item);
    }
  }
  const ordered = [...cols.values()].sort((x, y) => x.first.localeCompare(y.first) || x.dir.localeCompare(y.dir));
  ordered.forEach((c, i) => (c.position = Number(a["position-base"]) + i));
  return ordered;
}

function rowFor(c, it, position) {
  if (it.kind === "photo") {
    const id = sha(`lib:${it.id}`);
    const u = it.use;
    return {
      id, position, type: "image", orientation: it.orientation, width: u.width, height: u.height, source_id: it.id,
      files: [{ key: `${id}/orig.jpg`, file: path.join(LIB, "photos", u.file), type: "image/jpeg" }],
      key_main: `${id}/orig.jpg`, key_original: `${id}/orig.jpg`, key_poster: null,
      captured_at: it.capture ?? null, avg_colour: u.avg_colour, text_on: u.text_on, look: it.look, duration: null,
    };
  }
  const id = sha(`lib:${it.id}`);
  const u = it.looks.voyages;
  return {
    id, position, type: "video", orientation: it.orientation, width: u.width, height: u.height, source_id: it.id,
    files: [
      { key: `${id}/main.mp4`, file: path.join(LIB, "subclips", u.file), type: "video/mp4" },
      { key: `${id}/poster.jpg`, file: path.join(LIB, "subclips", u.poster), type: "image/jpeg" },
    ],
    key_main: `${id}/main.mp4`, key_original: null, key_poster: `${id}/poster.jpg`,
    captured_at: null, avg_colour: u.avg_colour, text_on: u.text_on, look: "voyages", duration: u.duration,
  };
}

// ---- upload with resume ----------------------------------------------------------------------------
const stateFile = path.join(".publish-state", `library-${a.target}.json`);
fs.mkdirSync(path.dirname(stateFile), { recursive: true });
const state = fs.existsSync(stateFile) ? JSON.parse(fs.readFileSync(stateFile, "utf8")) : {};
const flush = () => fs.writeFileSync(stateFile, JSON.stringify(state));

async function putAll(files) {
  const todo = files.filter((f) => {
    const st = fs.statSync(f.file);
    f.sig = `${st.size}:${Math.round(st.mtimeMs)}`;
    f.size = st.size;
    return state[f.key] !== f.sig;
  });
  let i = 0, done = 0, bytes = 0;
  const failures = [];
  const worker = async () => {
    while (i < todo.length) {
      const f = todo[i++];
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await sh(["r2", "object", "put", `${a.bucket}/${f.key}`, "--file", f.file, "--content-type", f.type, ...where]);
          state[f.key] = f.sig;
          done++;
          bytes += f.size;
          break;
        } catch (err) {
          if (attempt === 3) failures.push({ key: f.key, error: err.message });
          else await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
      if (done % 25 === 0) flush();
    }
  };
  await Promise.all(Array.from({ length: Number(a.concurrency) }, worker));
  flush();
  return { skipped: files.length - todo.length, uploaded: done, bytes, failures };
}

// ---- rows ------------------------------------------------------------------------------------------
async function slugFor(c, taken) {
  if (!remote && !taken) return c.slug;
  const own = taken.get(c.slug);
  return own && own.foreign > 0 ? `${c.slug}-library`.slice(0, 40) : c.slug; // never merge into something that is not from the library
}

function sqlFor(c, slug, rows) {
  const out = [`INSERT INTO collections (slug, title, position, published) VALUES (${q(slug)}, ${q(c.title)}, ${c.position}, 1)
ON CONFLICT(slug) DO UPDATE SET title = excluded.title, position = excluded.position;`];
  for (const r of rows) {
    out.push(`INSERT INTO media (id, collection, type, caption, place, orientation, width, height, position, published, featured,
  key_main, key_small, key_poster, size_bytes, key_original, captured_at, avg_colour, text_on, look, source_id, duration)
VALUES (${q(r.id)}, ${q(slug)}, ${q(r.type)}, '', '', ${q(r.orientation)}, ${r.width}, ${r.height}, ${r.position}, 1, 0,
  ${q(r.key_main)}, NULL, ${q(r.key_poster)}, ${r.files.reduce((n, f) => n + (f.size ?? 0), 0)}, ${q(r.key_original)}, ${q(r.captured_at)}, ${q(r.avg_colour)}, ${q(r.text_on)}, ${q(r.look)}, ${q(r.source_id)}, ${q(r.duration)})
ON CONFLICT(id) DO UPDATE SET collection = excluded.collection, position = excluded.position, width = excluded.width,
  height = excluded.height, orientation = excluded.orientation, key_main = excluded.key_main, key_poster = excluded.key_poster,
  key_original = excluded.key_original, size_bytes = excluded.size_bytes, captured_at = excluded.captured_at,
  avg_colour = excluded.avg_colour, text_on = excluded.text_on, look = excluded.look, duration = excluded.duration, published = 1,
  updated_at = datetime('now');`);
  }
  return out.join("\n");
}

async function existingCollections() {
  const out = await sh(["d1", "execute", "DB", ...where, "--json", "--command", "SELECT c.slug, (SELECT COUNT(*) FROM media m WHERE m.collection = c.slug AND m.source_id IS NULL) AS foreign_count FROM collections c"]);
  const rows = JSON.parse(out.slice(out.indexOf("[")))[0].results;
  return new Map(rows.map((r) => [r.slug, { foreign: r.foreign_count }]));
}

// ---- main ------------------------------------------------------------------------------------------
const cols = plan();
const nPhotos = cols.reduce((n, c) => n + c.photos.length, 0), nClips = cols.reduce((n, c) => n + c.clips.length, 0);
log(`plan: ${cols.length} collections, ${nPhotos} photos, ${nClips} clips${approvals ? " (approvals applied)" : " (no approvals file: every photo, voyages look)"}`);
for (const c of cols.slice(0, 80)) log(`  ${c.slug.padEnd(28)} ${String(c.photos.length).padStart(2)} photos ${String(c.clips.length).padStart(2)} clips  ${c.first.slice(0, 10)}  ${c.folders.length ? `(clip folders: ${c.folders.join(", ")})` : ""}`);
const unplaced = clipsM.subclips.filter((s) => !cols.some((c) => c.clips.includes(s)));
if (!a.only && unplaced.length) log(`  WARNING: ${unplaced.length} clips belong to no published collection`);
if (a["dry-run"]) process.exit(0);

const taken = remote ? await existingCollections() : await existingCollections().catch(() => null);
const report = { collections: 0, uploaded: 0, skipped: 0, bytes: 0, failures: [] };
for (const c of cols) {
  const slug = await slugFor(c, taken);
  const rows = c.items.map((it, i) => rowFor(c, it, i));
  const files = rows.flatMap((r) => r.files);
  const t0 = Date.now();
  const r = await putAll(files);
  report.uploaded += r.uploaded; report.skipped += r.skipped; report.bytes += r.bytes; report.failures.push(...r.failures);
  if (r.failures.length) {
    log(`✗ ${slug}: ${r.failures.length} file(s) failed, collection NOT published (rerun to retry)`);
    continue;
  }
  for (const row of rows) for (const f of row.files) f.size = f.size ?? fs.statSync(f.file).size;
  const sql = path.join(os.tmpdir(), `lib-${slug}.sql`);
  fs.writeFileSync(sql, sqlFor(c, slug, rows));
  await sh(["d1", "execute", "DB", ...where, "--file", sql]);
  fs.rmSync(sql);
  report.collections++;
  log(`✓ ${slug.padEnd(28)} ${c.photos.length} photos + ${c.clips.length} clips  uploaded ${r.uploaded} (${(r.bytes / 1048576).toFixed(0)} MB), skipped ${r.skipped}  in ${((Date.now() - t0) / 1000).toFixed(0)}s${slug !== c.slug ? `  [slug ${slug}: ${c.slug} already holds other items]` : ""}`);
}
// hide excluded clips an earlier run published (rows stay, published = 0; files stay in R2)
{
  const ids = [...EXCLUDED];
  const file = path.join(os.tmpdir(), "lib-hide.sql");
  fs.writeFileSync(file, ids.map((id) => `UPDATE media SET published = 0 WHERE source_id = ${q(id)};`).join("\n"));
  await sh(["d1", "execute", "DB", ...where, "--file", file]);
  fs.rmSync(file);
  log(`hidden: ${ids.length} excluded clips${a["exclude-borderline"] ? " (including the borderline list)" : ""}`);
}
log(`done: ${report.collections}/${cols.length} collections, ${report.uploaded} files uploaded (${(report.bytes / 1073741824).toFixed(2)} GB), ${report.skipped} unchanged, ${report.failures.length} failures`);
if (report.failures.length) {
  fs.writeFileSync(path.join(".publish-state", `failures-${a.target}.json`), JSON.stringify(report.failures, null, 1));
  process.exit(1);
}
