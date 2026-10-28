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
    "photos-dir": { type: "string", default: "web2560" }, // the 2560 px set; its own manifest has the real sizes and hero_ok
    "no-clips": { type: "boolean", default: false }, // photographs only (a quick local copy to build pages against)
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
// Video files are served from /m/<id>/main.mp4 with a one-year immutable cache, so a clip whose file was replaced after it was published needs a NEW id
// (the old row is retired below: published = 0, source_id freed). Norway C0017 is vertical footage that had been rendered sideways (no rotation flag).
const CLIP_REV = {
  "norway_2022/C0017_s1": 2, "norway_2022/C0017_s2": 2, // vertical footage that had been rendered sideways
  "newmexico_2021/C0001_s2": 2, // stabilised (vidstab on the 4K source, 2026-10-27)
  "norway_2022/C0011_s1": 2, "norway_2022/C0012_s1": 2, // flat grades: a highlight stretch was added after the LUT (pipeline/params/extra_vf.json)
  // Wyoming grade fixes (crushed shadows re-baked into the LUT, neon alpenglow toned, haze cut with a curve): files replaced, so new ids
  "grand_teton_2022/C0036_s1": 2, "grand_teton_2022/C0036_s2": 2, "grand_teton_2022/C0036_s3": 2, "grand_teton_2022/C0036_s4": 2, "grand_teton_2022/C0040_s1": 2, "grand_teton_2022/C0040_s2": 2, "grand_teton_2022/C0041_s1": 2, "grand_teton_2022/C0041_s2": 2, "grand_teton_2022/C0041_s3": 2, "grand_teton_2022/C0041_s4": 2, "grand_teton_2022/DJI_0375_s1": 2, "grand_teton_2022/DJI_0375_s2": 2, "yellowstone_2022/C0042_s1": 2, "yellowstone_2022/C0042_s2": 2, "yellowstone_2022/C0042_s3": 2, "yellowstone_2022/C0044_s1": 2, "yellowstone_2022/C0044_s2": 2, "yellowstone_2022/C0045_s1": 2, "yellowstone_2022/C0046_s1": 2, "yellowstone_2022/C0046_s2": 2, "yellowstone_2022/C0046_s3": 2, "yellowstone_2022/DJI_0399_s3": 2, "yellowstone_2022/DJI_0408_s1": 2, "yellowstone_2022/DJI_0408_s2": 2,
};
const clipId = (mid) => sha(CLIP_REV[mid] ? `lib:${mid}#r${CLIP_REV[mid]}` : `lib:${mid}`);
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
const PHOTO_DIR = path.join("photos", a["photos-dir"]);
const photosM = JSON.parse(fs.readFileSync(path.join(LIB, PHOTO_DIR, "manifest.json"), "utf8"));
// Photo revisions. A photograph's URL carries its rev (`?r=N`) and the sized copies are cached per rev, so a photograph whose file
// changed after it was published needs a new rev or the browser and the edge keep serving copies made from the old file.
// Every re-render pass since the first publish is one row here: the rev it hands out, the manifest saved just before it ran
// (`photos/<dir>/manifest.before_<pass>.json`), and what it changed about a photo ("bytes", or "size" when only a changed pixel
// size counts). A photo gets the rev of the newest pass that changed it; one no pass touched keeps BASE_REV. The manifests are
// optional: a missing one means that pass never ran against this library.
const BASE_REV = 2; // the 2560 px renders that replaced the 1280 px proofs under the same keys
const PASSES = [
  { rev: 3, before: "manifest.before_fromraw.json", by: "size" }, // re-rendered from RAW at the full 2560 px; they had been graded from 1024 / 1616 px camera previews (docs/photo-quality-audit.md)
  { rev: 4, before: "manifest.before_refit.json" }, // grade re-fitted from RAW (exposure fits that left them washed out)
  { rev: 5, before: "manifest.before_wyoming.json" }, // Wyoming re-graded from RAW: shadow recovery, sky / chroma guard, corner-vignette inset (photos/pipeline/regrade_wyoming.py)
  { rev: 6, before: "manifest.before_eureka_regrade.json" }, // Eureka re-graded for consistency (no purple casts, one colour treatment) and cut from 70 to 40 (render_eureka_sf.py)
  { rev: 7, before: "manifest.before_cartagena_regrade.json" }, // Cartagena re-graded from RAW with shadow recovery: a dog or a face had been graded as a silhouette (regrade_shadows.py)
  { rev: 8, before: "manifest.before_medellin_regrade.json" }, // Medellín re-graded from RAW: blown whites and crushed shadows recovered (regrade_shadows.py)
  { rev: 9, before: "manifest.before_westminster2020_regrade.json" }, // Westminster 2020 re-graded from RAW: crushed shadows and heavy yellow-green recovered
  { rev: 10, before: "manifest.before_newyork_regrade.json" }, // New York re-graded from RAW where the subject had gone black
  { rev: 11, before: "manifest.before_norway_regrade.json" }, // Norway re-graded from RAW: dark exposures lifted, sky colour kept, neon night casts tamed
  { rev: 12, before: "manifest.before_norway_sky.json" }, // Norway skies pushed: masked chroma and a little depth on sky pixels only (sky_boost.py)
  { rev: 13, before: "manifest.before_sky_all.json" }, // skies pushed on the other big-sky albums (Wyoming, Colorado, Ecuador, Arizona, New Mexico, Texas; sky_boost.py with a chroma ceiling)
  { rev: 14, before: "manifest.before_med_blacks.json" }, // Medellín frames with lifted blacks given rich blacks back (deepen_blacks.py); the butterflies re-graded from RAW first
  { rev: 15, before: "manifest.before_iceland_regrade.json" }, // Iceland re-graded from RAW: crushed fog silhouettes opened, neon horse / lagoon colour capped
  { rev: 16, before: "manifest.before_texas_regrade.json" }, // Texas re-graded from RAW: dark navy / violet corner halos, crushed Capitol and yuccas
  { rev: 17, before: "manifest.before_arizona_regrade.json" }, // Arizona re-graded from RAW (crushed cacti and rock opened, calmer colour), sky boost re-applied on the new renders
  { rev: 18, before: "manifest.before_dust.json" }, // dust spots healed (dust_spots.py); one White Sands frame's violet-black top-edge bleed fixed (top_band.py)
  { rev: 19, before: "manifest.before_dust2.json" }, // a second dust pass on Arizona's skies: faint round spots the first pass missed, checked by eye
  { rev: 20, before: "manifest.before_toko_rich.json" }, // Toko re-graded richer (render_toko_rich.py); the bench frame re-rendered later is covered too, its old bytes are in this manifest
];
const fingerprint = (u, by) => (by === "size" ? `${u.width}x${u.height}` : u.bytes);
const loadPass = ({ rev, before, by = "bytes" }) => {
  const file = path.join(LIB, PHOTO_DIR, before);
  const photos = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")).photos : [];
  return { rev, by, was: new Map(photos.map((p) => [p.id, fingerprint(p.looks.voyages, by)])) };
};
const passes = PASSES.map(loadPass).reverse(); // newest first: the latest pass that changed a photo wins
const photoRev = (it) => passes.find((p) => p.was.has(it.id) && p.was.get(it.id) !== fingerprint(it.use, p.by))?.rev ?? BASE_REV;
const clipsAll = JSON.parse(fs.readFileSync(path.join(LIB, "subclips/manifest.json"), "utf8"));
// Folders graded after the camera-original library (grade_proxies.py): each has its own entries.json, merged here so subclips/manifest.json stays the camera library's.
for (const f of ["eureka_2020", "san_francisco_2020", "phone_eureka", "phone_san_francisco", "phone_cartagena", "phone_medellin", "phone_westminster_2020", "phone_westminster_2021", "phone_nycc_2021", "phone_madeira", "phone_lisbon", "phone_stockholm", "phone_norway"]) {
  const ef = path.join(LIB, "subclips", f, "entries.json");
  if (fs.existsSync(ef)) clipsAll.subclips.push(...JSON.parse(fs.readFileSync(ef, "utf8")).filter((e) => !clipsAll.subclips.some((x) => x.id === e.id)));
}

// Duplicate clips are hidden, never deleted: ids listed in excluded-clips.json (see scripts/build-excluded-clips.mjs)
// are left out when the manifest is loaded, and any earlier-published row for them is unpublished (files stay in R2).
// --exclude-borderline also hides the similar-but-not-identical list.
const excludedFile = JSON.parse(fs.readFileSync(new URL("../excluded-clips.json", import.meta.url), "utf8"));
const EXCLUDED = new Set([...excludedFile.excluded, ...Object.keys(excludedFile.quality ?? {}), ...(a["exclude-borderline"] ? excludedFile.borderline : [])]);
// Near-duplicate photos are hidden from their gallery, never deleted: data/gallery-curation.json lists them by media id (and which photo is
// the cover of a gallery). They are left out of the plan below and set to published = 0; delete an entry and rerun to bring one back to its rank.
const CURATION = JSON.parse(fs.readFileSync(new URL("../data/gallery-curation.json", import.meta.url), "utf8"));
const HIDDEN_PHOTOS = new Set(CURATION.hidden.map((h) => h.id));
// Where each photo was made, and which trip (voyage) it belongs to (scripts/geotag-library.mjs). A collection on the site is a trip,
// named as the catalogue names it ("New Jersey"), not as the Lightroom folder was ("Chiyuki House 2025 New Jersey").
const GEOFILE = JSON.parse(fs.readFileSync(new URL("../data/library-geo.json", import.meta.url), "utf8"));
const GEO = GEOFILE.photos;
const TRIPS = GEOFILE.collections;
const LANDMARKS = new Map(JSON.parse(fs.readFileSync(new URL("../data/landmarks.json", import.meta.url), "utf8")).places.map((l) => [l.name, l]));
// Photos with no trip of their own (no shot of the catalogue near their date): the collection they sit in.
// Galleries are places. A subject that is not a place (Toko, a dog) is kept in storage but not shown: its collection is created with published = 0
// and a rerun never turns it back on (the upsert below leaves `published` alone). Turn one on in /admin when wanted.
const HIDDEN = new Set(["toko"]); // created unlisted: collections.published = 2, reachable at its address but not listed anywhere (see src/lib/collections.ts)
const FALLBACK = { new_jersey: { slug: "new-jersey", place: "New Jersey" }, toko: { slug: "toko", title: "Toko", place: "", order: 999 } };
// Which trip each clip folder belongs to, from looking at the footage (not the folder names):
//  - "New Mexico" and phoenix_2021 are the same Grand Canyon / Arizona-rim footage: both go to the Arizona trip
//  - uk_2023 is the Brighton seafront in 2023, not the 2017 London trip the manifest links it to
const CLIP_TRIP = {
  Madiera: "madeira", NY: "new-york", "New Mexico": "arizona", phoenix_2021: "arizona", newmexico_2021: "new-mexico", colorado: "colorado",
  bogota_2023: "bogota", ecuador_2023: "ecuador", grand_teton_2022: "wyoming-2022", yellowstone_2022: "wyoming-2022", norway_2022: "norway",
  oaxaca_2025: "oaxaca", stockholm_2022: "stockholm", texas_2021: "texas", uk_2023: "brighton", westminster_2021: "westminster-2021",
  // 1080p proxies of the Eureka / San Francisco footage (the originals are not on any drive) and the phone videos from Photos (graded by pipeline/lib/grade_proxies.py)
  eureka_2020: "eureka", san_francisco_2020: "san-francisco", phone_eureka: "eureka", phone_san_francisco: "san-francisco", phone_cartagena: "cartagena", phone_medellin: "medellin",
  phone_westminster_2020: "westminster-2020", phone_westminster_2021: "westminster-2021", phone_nycc_2021: "nycc-2021", phone_madeira: "madeira", phone_lisbon: "lisbon",
  phone_stockholm: "stockholm", phone_norway: "norway",
};
/** A named place for a clip when the footage says where it is; otherwise the trip's own place. */
function clipLandmark(s) {
  if (s.folder === "New Mexico" || s.folder === "phoenix_2021") return "Grand Canyon National Park, Arizona";
  if (s.folder === "grand_teton_2022") return "Grand Teton National Park, Wyoming";
  if (s.folder === "yellowstone_2022") return "Yellowstone National Park, Wyoming";
  if (s.folder === "newmexico_2021" && /^C000[12]\.MP4$/.test(s.source)) return "White Sands National Park, New Mexico";
  if (s.folder === "newmexico_2021" && s.source === "C0003.MP4") return "Rio Grande Gorge Bridge, New Mexico";
  // by eye: banded red cliffs over a lake (Abiquiu), and moonrise over snow-patched badlands (Bisti, like the photographs from that evening)
  if (s.folder === "newmexico_2021" && (/^C000[45]\.MP4$/.test(s.source) || s.source.startsWith("staging/"))) return "Abiquiu Lake, New Mexico";
  if (s.folder === "newmexico_2021" && /^C000[67]\.MP4$/.test(s.source)) return "Bisti/De-Na-Zin Wilderness, New Mexico";
  if (s.folder === "colorado") return s.source === "C0007.MP4" ? "Garden of the Gods, Colorado" : "Great Sand Dunes National Park, Colorado";
  if (s.folder === "texas_2021" && /^C000[245]\.MP4$/.test(s.source)) return "Texas State Capitol, Austin, Texas";
  if (s.folder === "texas_2021" && /^C00(07|09|17|19|20)\.MP4$/.test(s.source)) return "Big Bend National Park, Texas";
  return null;
}
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

function plan() {
  const only = a.only ? new Set(a.only.split(",")) : null;
  const cols = new Map();
  for (const p of photosM.photos) {
    const look = approvals ? approvals.get(p.id) : p.looks.nykelab ? "nykelab" : "voyages"; // new shoots carry the one nykelab look (LibraryGrade/GRADING.md); the older library has voyages / tmag
    if (!look) continue;
    if (HIDDEN_PHOTOS.has(sha(`lib:${p.id}`))) continue;
    const dir = p.id.split("/")[0];
    const fb = FALLBACK[dir];
    const slug = GEO[p.id]?.collection ?? fb?.slug ?? dir.replace(/_/g, "-").toLowerCase();
    if (only && !only.has(slug)) continue;
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(slug)) throw new Error(`bad slug ${slug}`);
    const meta = TRIPS[slug];
    const c = cols.get(slug) ?? {
      slug, title: meta?.title ?? fb?.title ?? titleCase(p.collection), place: meta?.place ?? fb?.place ?? "", lat: meta?.lat ?? null, lon: meta?.lon ?? null,
      order: meta?.order ?? fb?.order ?? 998, photos: [], clips: [],
    };
    c.photos.push({ ...p, use: p.looks[look], look });
    cols.set(slug, c);
  }
  for (const s of a["no-clips"] ? [] : clipsM.subclips) {
    const c = cols.get(CLIP_TRIP[s.folder]);
    if (c) c.clips.push(s);
  }
  // interleave: photos by rank, clips by quality, clips spread evenly, rank 1 stays first
  for (const c of cols.values()) {
    c.photos.sort((x, y) => x.rank - y.rank);
    const cover = c.photos.findIndex((p) => sha(`lib:${p.id}`) === CURATION.covers?.[c.slug]?.id);
    if (cover > 0) c.photos.unshift(...c.photos.splice(cover, 1)); // a gallery's chosen cover goes first
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
  const ordered = [...cols.values()].sort((x, y) => x.order - y.order || x.slug.localeCompare(y.slug));
  ordered.forEach((c, i) => (c.position = Number(a["position-base"]) + i));
  return ordered;
}

function rowFor(c, it, position) {
  if (it.kind === "photo") {
    const id = sha(`lib:${it.id}`);
    const u = it.use;
    const g = GEO[it.id];
    return {
      id, position, type: "image", orientation: it.orientation, width: u.width, height: u.height, source_id: it.id,
      files: [{ key: `${id}/orig.jpg`, file: path.join(LIB, PHOTO_DIR, u.file), type: "image/jpeg" }],
      key_main: `${id}/orig.jpg`, key_original: `${id}/orig.jpg`, key_poster: null,
      captured_at: it.capture ?? null, avg_colour: u.avg_colour, text_on: u.text_on, look: it.look, duration: null,
      hero_ok: it.hero_ok ? 1 : 0, rev: photoRev(it),
      place: g?.place ?? c.place, geo_lat: g ? g.lat : c.lat, geo_lon: g ? g.lon : c.lon, geo_source: g ? g.source : c.place ? "trip" : "",
    };
  }
  const id = clipId(it.id);
  const u = it.looks.voyages;
  const lm = LANDMARKS.get(clipLandmark(it) ?? "");
  const clip = lm ? { place: lm.name, lat: Math.round(lm.lat * 100) / 100, lon: Math.round(lm.lon * 100) / 100 } : { place: c.place, lat: c.place.includes(",") ? c.lat : null, lon: c.place.includes(",") ? c.lon : null }; // no pin for a whole state
  return {
    id, position, type: "video", orientation: it.orientation, width: u.width, height: u.height, source_id: it.id,
    files: [
      { key: `${id}/main.mp4`, file: path.join(LIB, "subclips", u.file), type: "video/mp4" },
      { key: `${id}/poster.jpg`, file: path.join(LIB, "subclips", u.poster), type: "image/jpeg" },
    ],
    key_main: `${id}/main.mp4`, key_original: null, key_poster: `${id}/poster.jpg`,
    captured_at: null, avg_colour: u.avg_colour, text_on: u.text_on, look: "voyages", duration: u.duration,
    hero_ok: 1, rev: 1,
    place: clip.place, geo_lat: clip.lat, geo_lon: clip.lon, geo_source: clip.place ? "trip" : "",
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
  const out = [`INSERT INTO collections (slug, title, position, published) VALUES (${q(slug)}, ${q(c.title)}, ${c.position}, ${HIDDEN.has(slug) ? 2 : 1})
ON CONFLICT(slug) DO UPDATE SET title = excluded.title, position = excluded.position;`];
  for (const r of rows) {
    out.push(`INSERT INTO media (id, collection, type, caption, place, orientation, width, height, position, published, featured,
  key_main, key_small, key_poster, size_bytes, key_original, captured_at, avg_colour, text_on, look, source_id, duration,
  geo_lat, geo_lon, geo_source, hero_ok, rev)
VALUES (${q(r.id)}, ${q(slug)}, ${q(r.type)}, '', ${q(r.place)}, ${q(r.orientation)}, ${r.width}, ${r.height}, ${r.position}, 1, 0,
  ${q(r.key_main)}, NULL, ${q(r.key_poster)}, ${r.files.reduce((n, f) => n + (f.size ?? 0), 0)}, ${q(r.key_original)}, ${q(r.captured_at)}, ${q(r.avg_colour)}, ${q(r.text_on)}, ${q(r.look)}, ${q(r.source_id)}, ${q(r.duration)},
  ${q(r.geo_lat)}, ${q(r.geo_lon)}, ${q(r.geo_source)}, ${r.hero_ok}, ${r.rev})
ON CONFLICT(id) DO UPDATE SET collection = excluded.collection, position = excluded.position, width = excluded.width,
  height = excluded.height, orientation = excluded.orientation, key_main = excluded.key_main, key_poster = excluded.key_poster,
  key_original = excluded.key_original, size_bytes = excluded.size_bytes, captured_at = excluded.captured_at,
  avg_colour = excluded.avg_colour, text_on = excluded.text_on, look = excluded.look, duration = excluded.duration, published = 1,
  hero_ok = excluded.hero_ok, rev = excluded.rev, place = excluded.place, geo_lat = excluded.geo_lat, geo_lon = excluded.geo_lon, geo_source = excluded.geo_source,
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
for (const c of cols.slice(0, 80)) log(`  ${c.slug.padEnd(28)} ${String(c.photos.length).padStart(2)} photos ${String(c.clips.length).padStart(2)} clips  ${c.title}`);
const unplaced = clipsM.subclips.filter((s) => !cols.some((c) => c.clips.includes(s)));
if (!a.only && unplaced.length) log(`  WARNING: ${unplaced.length} clips belong to no published collection`);
if (a["dry-run"]) process.exit(0);

// retire the rows of clips that were replaced under a new id (idempotent: once source_id carries the suffix it no longer matches)
{
  const file = path.join(os.tmpdir(), "lib-retire-clips.sql");
  fs.writeFileSync(file, Object.keys(CLIP_REV).map((mid) => `UPDATE media SET published = 0, source_id = source_id || '#old' WHERE id = ${q(sha(`lib:${mid}`))} AND source_id = ${q(mid)};`).join("\n"));
  if (!a["dry-run"]) await sh(["d1", "execute", "DB", ...where, "--file", file]);
  fs.rmSync(file);
}
const taken = remote ? await existingCollections() : await existingCollections().catch(() => null);
const usedSlugs = [];
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
  usedSlugs.push(slug);
  log(`✓ ${slug.padEnd(28)} ${c.photos.length} photos + ${c.clips.length} clips  uploaded ${r.uploaded} (${(r.bytes / 1048576).toFixed(0)} MB), skipped ${r.skipped}  in ${((Date.now() - t0) / 1000).toFixed(0)}s${slug !== c.slug ? `  [slug ${slug}: ${c.slug} already holds other items]` : ""}`);
}
// Collections an earlier run published per Lightroom folder have been folded into their trip: take the emptied ones off the site
// (the rows stay, published = 0; anything that still holds published items, like your own uploads, is left alone).
if (!a.only) {
  const old = [...new Set(photosM.photos.map((p) => p.id.split("/")[0].replace(/_/g, "-").toLowerCase()))].filter((x) => !usedSlugs.includes(x));
  const file = path.join(os.tmpdir(), "lib-retire.sql");
  fs.writeFileSync(file, old.map((x) => `UPDATE collections SET published = 0 WHERE slug = ${q(x)} AND NOT EXISTS (SELECT 1 FROM media m WHERE m.collection = ${q(x)} AND m.published = 1);`).join("\n"));
  await sh(["d1", "execute", "DB", ...where, "--file", file]);
  fs.rmSync(file);
  log(`retired up to ${old.length} per-folder collections that are now part of a trip`);
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
// hide the curated near-duplicates an earlier run published (rows stay, published = 0; files stay in R2)
{
  const file = path.join(os.tmpdir(), "lib-hide-photos.sql");
  fs.writeFileSync(file, [...HIDDEN_PHOTOS].map((id) => `UPDATE media SET published = 0 WHERE id = ${q(id)} AND source_id IS NOT NULL;`).join("\n"));
  await sh(["d1", "execute", "DB", ...where, "--file", file]);
  fs.rmSync(file);
  log(`hidden: ${HIDDEN_PHOTOS.size} near-duplicate photos (data/gallery-curation.json)`);
}
log(`done: ${report.collections}/${cols.length} collections, ${report.uploaded} files uploaded (${(report.bytes / 1073741824).toFixed(2)} GB), ${report.skipped} unchanged, ${report.failures.length} failures`);
if (report.failures.length) {
  fs.writeFileSync(path.join(".publish-state", `failures-${a.target}.json`), JSON.stringify(report.failures, null, 1));
  process.exit(1);
}
