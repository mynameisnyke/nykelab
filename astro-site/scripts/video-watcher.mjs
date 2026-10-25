#!/usr/bin/env node
// Video watcher (local dev). Drop a clip into a folder; it is converted to a muted, web-friendly H.264 MP4 with a
// poster frame and uploaded to the admin, so it shows up on the collection page without any other step.
//
//   npm run video:watch                      watch the default folder until stopped (Ctrl-C)
//   npm run video:watch -- --once            convert whatever is there now, then exit
//   npm run video:watch -- --no-upload       only convert (files land in the out folder)
//
// Layout:   <watch>/<collection>/<clip>.mov      the folder name is the collection ("bogota" -> Bogota, /bogota)
//           <out>/<collection>/<clip>.mp4 + .jpg the converted file and its poster
// Clips directly in <watch> go to the collection named by --collection (default "videos").
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";
import { DEFAULTS, VIDEO_EXT, convert, localCapture, makePoster, parseLocation } from "./video/convert.mjs";
import { ensureCollection, uploadVideo } from "./video/upload.mjs";

const { values: a } = parseArgs({
  options: {
    watch: { type: "string" },
    out: { type: "string" },
    api: { type: "string", default: process.env.NYKELAB_API || "http://localhost:4322" },
    collection: { type: "string", default: "videos" },
    once: { type: "boolean", default: false },
    "no-upload": { type: "boolean", default: false },
    "keep-audio": { type: "boolean", default: false },
    "max-edge": { type: "string", default: String(DEFAULTS.maxEdge) },
    crf: { type: "string", default: String(DEFAULTS.crf) },
    "max-seconds": { type: "string", default: "0" },
    interval: { type: "string", default: "3" },
    help: { type: "boolean", short: "h", default: false },
  },
});

if (a.help) {
  console.log(`video-watcher  [--watch DIR] [--out DIR] [--api URL] [--collection NAME] [--once] [--no-upload]
               [--keep-audio] [--max-edge 1920] [--crf 23] [--max-seconds 0] [--interval 3]
defaults: watch ${defaultWatch()}   api http://localhost:4322 (dev server, no login)`);
  process.exit(0);
}

function defaultWatch() {
  return process.env.NYKELAB_VIDEO_WATCH || (fs.existsSync("/Volumes/Whiskey/Exports") ? "/Volumes/Whiskey/Exports/video-in" : path.join(os.homedir(), "Movies", "nykelab-video-in"));
}
const watchDir = path.resolve(a.watch ?? defaultWatch());
const outDir = path.resolve(a.out ?? path.join(path.dirname(watchDir), "video-out"));
fs.mkdirSync(watchDir, { recursive: true });
fs.mkdirSync(outDir, { recursive: true });
const opts = { maxEdge: Number(a["max-edge"]), crf: Number(a.crf), keepAudio: a["keep-audio"], maxSeconds: Number(a["max-seconds"]) };

// ---- what has been done (survives restarts; a changed file is processed again) -----------------------
const statePath = path.join(outDir, ".video-state.json");
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : {};
const save = () => fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
const fingerprint = (file, st) => `${path.relative(watchDir, file)}|${st.size}|${Math.round(st.mtimeMs)}`;

const log = (...m) => console.log(new Date().toTimeString().slice(0, 8), ...m);

function* scan(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".")) continue; // .DS_Store, ._resource forks, hidden temp files
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* scan(p);
    else if (VIDEO_EXT.test(e.name)) yield p;
  }
}

async function processFile(file, st) {
  const rel = path.relative(watchDir, file);
  const folder = path.dirname(rel) === "." ? a.collection : rel.split(path.sep)[0];
  const base = path.basename(file, path.extname(file));
  const dest = path.join(outDir, folder);
  fs.mkdirSync(dest, { recursive: true });
  let out = path.join(dest, `${base}.mp4`);
  for (let n = 2; fs.existsSync(out) && !state[fingerprint(file, st)]; n++) out = path.join(dest, `${base}-${n}.mp4`);
  const poster = out.replace(/\.mp4$/, ".jpg");

  log(`converting  ${rel}`);
  const t0 = Date.now();
  const { source, output } = await convert(file, out, opts);
  await makePoster(out, poster, opts);
  const mb = (n) => (n / 1048576).toFixed(1);
  log(`converted   ${rel}: ${source.width}x${source.height} ${source.duration.toFixed(1)}s${source.hdr ? " HDR->SDR" : ""} ${mb(source.bytes)} MB -> ${output.width}x${output.height} ${mb(output.bytes)} MB in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  if (source.duration > 60) log(`  note: ${rel} is ${Math.round(source.duration)} s long; background clips are best under 30 s (use --max-seconds to trim)`);

  let id = null;
  if (!a["no-upload"]) {
    const collection = await ensureCollection(a.api, folder);
    const loc = parseLocation(source.tags);
    const media = await uploadVideo({
      api: a.api,
      collection,
      video: out,
      poster,
      width: output.width,
      height: output.height,
      meta: { capturedAt: localCapture(source.tags), ...(loc ?? {}) },
    });
    id = media.id;
    log(`uploaded    ${rel} -> /${collection}${media.place ? `  (${media.place})` : ""}`);
  }
  state[fingerprint(file, st)] = { id, collection: folder, output: path.relative(outDir, out), at: new Date().toISOString() };
  save();
}

// ---- the loop: wait for each file to stop growing (still being copied), then convert one at a time ---
const seen = new Map(); // file -> { size, mtimeMs, stable }
let busy = false;

async function tick() {
  if (busy) return;
  busy = true;
  try {
    for (const file of scan(watchDir)) {
      let st;
      try { st = fs.statSync(file); } catch { continue; }
      if (!st.size || state[fingerprint(file, st)]) continue;
      const prev = seen.get(file);
      const same = prev && prev.size === st.size && prev.mtimeMs === st.mtimeMs;
      seen.set(file, { size: st.size, mtimeMs: st.mtimeMs, stable: same ? prev.stable + 1 : 0 });
      if (seen.get(file).stable < 1) continue; // unchanged for one full interval
      try {
        await processFile(file, st);
      } catch (err) {
        log(`FAILED      ${path.relative(watchDir, file)}: ${err.message}`);
        state[fingerprint(file, st)] = { id: null, error: String(err.message).slice(0, 300), at: new Date().toISOString() };
        save(); // not retried until the file changes; delete its line from .video-state.json to retry
      }
    }
  } finally {
    busy = false;
  }
}

log(`watching ${watchDir}`);
log(`output   ${outDir}   ${a["no-upload"] ? "(not uploading)" : `upload -> ${a.api}`}`);
if (a.once) {
  await tick();
  await new Promise((r) => setTimeout(r, 1200)); // second pass confirms files are stable
  await tick();
  log("done");
} else {
  const every = Math.max(1, Number(a.interval)) * 1000;
  setInterval(tick, every);
  tick();
}
