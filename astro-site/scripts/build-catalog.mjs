// Lightroom CSV -> src/data/catalog.json (what the home, Places and Years pages read) + docs/catalog-report.md.
//
//   npm run catalog -- /Volumes/Whiskey/photos-3plus-or-picked.csv
//
// The CSV is metadata only. Rules (all reported in docs/catalog-report.md, none silent):
//  - one row per photo: de-duplicated by lr_id (a photo in Cartagena and Cartagena Finals counts once); rejects dropped
//  - collections -> voyages via scripts/catalog/voyages.mjs; unlisted collections are reported, not imported
//  - "Finals"/"Picks" collections mix trips: a photo dated outside its voyage's main cluster moves to the voyage whose dates contain it
//  - location is the voyage's place (city level), never the photo's GPS; GPS only refines `approx` places, rounded to 0.1 degree
//  - utc_offset is ignored (the cameras stamped it wrong); capture_local is the wall clock
//  - clock: for each (voyage, camera, date) group where the wall clock reads night but flipped by 12 h reads day, the hour is
//    flipped, SAME calendar date. Override per voyage or per group in scripts/catalog/clock-overrides.json (0 = leave, 12 = flip)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PALETTE, SERIES, VOYAGES } from "./catalog/voyages.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const csvPath = process.argv[2];
if (!csvPath) {
  console.error("usage: node scripts/build-catalog.mjs <photos.csv>");
  process.exit(1);
}
const overrides = JSON.parse(fs.readFileSync(path.join(root, "scripts/catalog/clock-overrides.json"), "utf8"));
const DAY = 86400000;

// ---- csv ------------------------------------------------------------------------------------
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') (text[i + 1] === '"' ? ((cell += '"'), i++) : (q = false));
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") (row.push(cell), (cell = ""));
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) (row.push(cell), rows.push(row));
  const [head, ...body] = rows;
  return body.map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

// ---- helpers --------------------------------------------------------------------------------
const RAD = Math.PI / 180;
/** Same approximation as src/lib/voyages.ts: half-day length in hours for a latitude and date. */
function halfDay(lat, t) {
  const d = new Date(t);
  const n = Math.floor((t - Date.UTC(d.getUTCFullYear(), 0, 0)) / DAY);
  const decl = 23.44 * RAD * Math.sin(((2 * Math.PI) / 365) * (284 + n));
  const x = -Math.tan(lat * RAD) * Math.tan(decl);
  return Math.acos(Math.min(1, Math.max(-1, x))) / RAD / 15;
}
const offCache = new Map();
/** UTC offset in hours (DST-aware) of an IANA zone on a calendar date (checked at local noon). */
function tzOffset(tz, date) {
  const k = `${tz}|${date}`;
  if (!offCache.has(k)) {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "longOffset" }).formatToParts(new Date(`${date}T17:00:00Z`));
    const m = /GMT([+-])(\d\d):?(\d\d)?/.exec(parts.find((p) => p.type === "timeZoneName").value);
    offCache.set(k, m ? (m[1] === "-" ? -1 : 1) * (+m[2] + (+m[3] || 0) / 60) : 0);
  }
  return offCache.get(k);
}
/** Is this wall-clock hour in daylight (with 30 min of twilight) at the voyage's place? */
function isDay(v, date, hour) {
  const t = Date.parse(`${date}T12:00:00Z`);
  const noon = 12 + tzOffset(v.tz, date) - v.lon / 15;
  const off = Math.abs((((hour - noon + 12) % 24) + 24) % 24 - 12);
  return off <= halfDay(v.lat, t) + 0.5;
}
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
const FOCAL_BINS = [14, 16, 20, 24, 28, 35, 50, 70, 85, 100, 135, 150, 200, 300, 400];
const APERTURES = [1.4, 1.8, 2, 2.5, 2.8, 3.5, 4, 5, 5.6, 7.1, 8, 11, 16, 22];
const nearestLog = (list, x) => list.reduce((b, c) => (Math.abs(Math.log(c / x)) < Math.abs(Math.log(b / x)) ? c : b));
const hourOf = (iso) => +iso.slice(11, 13) + +iso.slice(14, 16) / 60 + (+iso.slice(17, 19) || 0) / 3600;
const dateOf = (iso) => iso.slice(0, 10);
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0);

// ---- load, de-dupe, assign to voyages -------------------------------------------------------
const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
const seen = new Set();
const stats = { rows: rows.length, rejects: 0, dupes: 0, unmapped: new Map(), noDate: 0 };
const byCollection = new Map();
VOYAGES.forEach((v, i) => v.collections.forEach((c) => byCollection.set(c, [...(byCollection.get(c) ?? []), i])));

/** @type {{r:any, vi:number, date:string, clock:number}[]} */
let shots = [];
for (const r of rows) {
  if (r.pick_flag === "reject") {
    stats.rejects++;
    continue;
  }
  if (seen.has(r.lr_id)) {
    stats.dupes++;
    continue;
  }
  if (!/^\d{4}-\d\d-\d\dT/.test(r.capture_local)) {
    stats.noDate++;
    continue;
  }
  const date = dateOf(r.capture_local);
  const cands = (byCollection.get(r.collection) ?? []).filter((i) => (!VOYAGES[i].from || date >= VOYAGES[i].from) && (!VOYAGES[i].to || date <= VOYAGES[i].to));
  if (!cands.length) {
    stats.unmapped.set(r.collection, (stats.unmapped.get(r.collection) ?? 0) + 1);
    continue;
  }
  seen.add(r.lr_id);
  shots.push({ r, vi: cands[0], date, clock: hourOf(r.capture_local) });
}

// ---- main cluster per voyage, move stragglers ------------------------------------------------
const dayNum = (d) => Math.floor(Date.parse(`${d}T00:00:00Z`) / DAY);
function mainCluster(list) {
  const days = [...new Set(list.map((s) => dayNum(s.date)))].sort((a, b) => a - b);
  const counts = new Map();
  list.forEach((s) => counts.set(dayNum(s.date), (counts.get(dayNum(s.date)) ?? 0) + 1));
  const clusters = [];
  for (const d of days) {
    const last = clusters[clusters.length - 1];
    if (last && d - last.end <= 45) ((last.end = d), (last.n += counts.get(d)));
    else clusters.push({ start: d, end: d, n: counts.get(d) });
  }
  return clusters.sort((a, b) => b.n - a.n)[0];
}
const range = VOYAGES.map((v, i) => (v.open ? null : mainCluster(shots.filter((s) => s.vi === i)) ?? null));
const moved = new Map(), unplaced = new Map();
const note = (m, k) => m.set(k, (m.get(k) ?? 0) + 1);
shots = shots.filter((s) => {
  const rg = range[s.vi];
  if (!rg) return true;
  const d = dayNum(s.date);
  if (d >= rg.start - 2 && d <= rg.end + 2) return true;
  const to = range.findIndex((x, j) => x && j !== s.vi && d >= x.start - 2 && d <= x.end + 2);
  if (to >= 0) {
    note(moved, `${s.r.collection} -> ${VOYAGES[to].title} (${s.date})`);
    s.vi = to;
    return true;
  }
  note(unplaced, `${s.r.collection} (${s.date.slice(0, 7)}) not near any voyage`);
  return false;
});

// ---- voyage geography (GPS only refines approximate places) -----------------------------------
const geo = VOYAGES.map((v, i) => {
  const gps = shots.filter((s) => s.vi === i && s.r.gps_lat && s.r.gps_lon);
  if (v.approx && gps.length >= 3) return { lat: +median(gps.map((s) => +s.r.gps_lat)).toFixed(1), lon: +median(gps.map((s) => +s.r.gps_lon)).toFixed(1), refined: gps.length };
  return { lat: v.lat, lon: v.lon, refined: 0 };
});

// ---- clock: flip 12 h where the wall clock says night and flipped says day --------------------
const groups = new Map();
for (const s of shots) {
  const k = `${VOYAGES[s.vi].id}|${s.r.camera}|${s.date}`;
  groups.set(k, [...(groups.get(k) ?? []), s]);
}
const flips = [], ambiguous = [];
const flipGroup = (k, g, dark, darkAfter, forced, why) => {
  g.forEach((s) => ((s.clock = (s.clock + 12) % 24), (s.flipped = true)));
  flips.push({ k, n: g.length, dark: pct(dark, g.length), after: pct(darkAfter, g.length), forced, why });
};
const stat = (k, g) => {
  const v = { ...VOYAGES[g[0].vi], ...geo[g[0].vi] };
  return { dark: g.filter((s) => !isDay(v, s.date, s.clock)).length, darkAfter: g.filter((s) => !isDay(v, s.date, (s.clock + 12) % 24)).length };
};
const maybe = [];
for (const [k, g] of groups) {
  const [vid] = k.split("|");
  const { dark, darkAfter } = stat(k, g);
  const forced = overrides[k] ?? overrides[vid];
  if (forced !== undefined) {
    if (forced === 12) flipGroup(k, g, dark, darkAfter, true);
  } else if (g.length >= 12 && dark / g.length >= 0.8 && darkAfter / g.length <= 0.1) flipGroup(k, g, dark, darkAfter, false);
  else if (g.length >= 12 && dark / g.length >= 0.5 && darkAfter / g.length <= 0.3) maybe.push({ k, g, dark, darkAfter });
}
// A camera's clock error persists from day to day: a doubtful day follows a flipped day of the same camera on the same voyage.
for (const m of maybe) {
  const sibling = flips.some((f) => f.k.split("|").slice(0, 2).join("|") === m.k.split("|").slice(0, 2).join("|"));
  if (sibling) flipGroup(m.k, m.g, m.dark, m.darkAfter, false, "follows a flipped day, same camera and voyage");
  else ambiguous.push({ k: m.k, n: m.g.length, dark: pct(m.dark, m.g.length), after: pct(m.darkAfter, m.g.length) });
}

// ---- assemble ----------------------------------------------------------------------------------
const order = VOYAGES.map((_, i) => i).filter((i) => shots.some((s) => s.vi === i));
const startOf = (i) => Math.min(...shots.filter((s) => s.vi === i).map((s) => Date.parse(`${s.date}T00:00:00Z`)));
order.sort((a, b) => startOf(a) - startOf(b));
const newIndex = new Map(order.map((vi, n) => [vi, n]));
const lenses = [];
const lensIdx = (s) => {
  const name = s.r.lens || s.r.camera || "Unknown";
  if (!lenses.includes(name)) lenses.push(name);
  return lenses.indexOf(name);
};

const outShots = [];
const voyagesOut = order.map((vi, n) => {
  const v = VOYAGES[vi];
  const mine = shots.filter((s) => s.vi === vi);
  const core = range[vi] ? mine.filter((s) => dayNum(s.date) >= range[vi].start - 2 && dayNum(s.date) <= range[vi].end + 2) : mine;
  const times = core.map((s) => Date.parse(`${s.date}T00:00:00Z`));
  const { lat, lon } = geo[vi];
  for (const s of mine) {
    const off = tzOffset(v.tz, s.date);
    const solar = (((s.clock - (off - lon / 15)) % 24) + 24) % 24;
    const t = Math.round((Date.parse(`${s.date}T00:00:00Z`) + s.clock * 3600000) / 60000);
    outShots.push([n, t, Math.round(solar * 100) % 2400, Math.round(s.clock * 100) % 2400, nearestLog(FOCAL_BINS, +s.r.focal_length_mm || 50), nearestLog(APERTURES, +s.r.aperture || 5.6), +s.r.iso || 0, s.r.shutter, lensIdx(s)]);
  }
  return {
    id: v.id,
    slug: v.slug ?? v.id,
    title: v.title,
    kind: v.kind,
    ...(v.series ? { series: v.series } : {}),
    placeSlug: v.placeSlug,
    placeName: v.placeName,
    place: v.place,
    country: v.country,
    lat,
    lon,
    theme: v.theme,
    color: PALETTE[n % PALETTE.length],
    start: Math.min(...times),
    end: Math.max(...times),
    count: mine.length,
  };
});
outShots.sort((a, b) => a[1] - b[1]);

fs.mkdirSync(path.join(root, "src/data"), { recursive: true });
fs.writeFileSync(path.join(root, "src/data/catalog.json"), JSON.stringify({ source: path.basename(csvPath), series: SERIES, voyages: voyagesOut, lenses, shots: outShots }));

// ---- report ------------------------------------------------------------------------------------
const flippedBy = (vid) => flips.filter((f) => f.k.startsWith(vid + "|"));
const lines = [];
lines.push("# Catalog build report", "", `Source: \`${path.basename(csvPath)}\`. Regenerate: \`npm run catalog -- <csv>\`. Overrides: \`scripts/catalog/clock-overrides.json\`.`, "");
lines.push(`- ${stats.rows} rows -> **${outShots.length} photographs** in **${voyagesOut.length} voyages**`);
lines.push(`- dropped: ${stats.rejects} rejects, ${stats.dupes} duplicates (same photo in several collections), ${stats.noDate} without a capture date, ${[...unplaced.values()].reduce((a, b) => a + b, 0)} not near any voyage's dates`, "");
lines.push("## Voyages", "", "| voyage | kind | photos | dates | place | clock flips |", "|---|---|---:|---|---|---|");
for (const v of voyagesOut) {
  const f = flippedBy(v.id);
  const src = VOYAGES.find((x) => x.id === v.id);
  const g = geo[VOYAGES.indexOf(src)];
  const when = `${new Date(v.start).toISOString().slice(0, 10)} to ${new Date(v.end).toISOString().slice(0, 10)}`;
  lines.push(`| ${v.title} | ${v.kind} | ${v.count} | ${when} | ${v.place}${src.approx ? (g.refined ? ` (refined from ${g.refined} GPS photos)` : " (**approximate**)") : ""} | ${f.length ? `${f.reduce((a, x) => a + x.n, 0)} photos in ${f.length} group(s)` : ""} |`);
}
lines.push("", "## Clock: groups flipped by 12 hours (same date)", "", "Rule: at least 12 photos from one camera on one date, at least 80% at night by the wall clock and at most 10% at night once flipped. `dark` = night before, `after` = night after the flip.", "", "| voyage / camera / date | photos | dark | after |", "|---|---:|---:|---:|");
flips.forEach((f) => lines.push(`| ${f.k.replaceAll("|", " / ")}${f.forced ? " (override)" : ""}${f.why ? ` (${f.why})` : ""} | ${f.n} | ${f.dark}% | ${f.after}% |`));
if (!flips.length) lines.push("| none | | | |");
lines.push("", "## Clock: groups that look off but were NOT flipped", "", "At least half at night, and flipping would fix most of it, but not clearly enough. Could be real night or evening shooting. Decide with brightness, then add to the overrides file.", "", "| voyage / camera / date | photos | dark | after |", "|---|---:|---:|---:|");
ambiguous.forEach((f) => lines.push(`| ${f.k.replaceAll("|", " / ")} | ${f.n} | ${f.dark}% | ${f.after}% |`));
if (!ambiguous.length) lines.push("| none | | | |");
lines.push("", "## Moved between voyages by date", "", "Photos in a collection that sit outside its voyage's dates, placed with the voyage whose dates contain them.", "");
[...moved].sort().forEach(([k, n]) => lines.push(`- ${k}: ${n}`));
if (!moved.size) lines.push("- none");
lines.push("", "## Left out", "");
[...unplaced].sort().forEach(([k, n]) => lines.push(`- ${k}: ${n} photos`));
[...stats.unmapped].sort().forEach(([k, n]) => lines.push(`- collection not in voyages.mjs: ${k}: ${n} photos`));
if (!unplaced.size && !stats.unmapped.size) lines.push("- nothing");
fs.writeFileSync(path.join(root, "docs/catalog-report.md"), lines.join("\n") + "\n");

console.log(`${outShots.length} photographs, ${voyagesOut.length} voyages, ${flips.length} clock groups flipped, ${ambiguous.length} ambiguous, ${[...unplaced.values()].reduce((a, b) => a + b, 0)} left out`);
console.log("wrote src/data/catalog.json and docs/catalog-report.md");
