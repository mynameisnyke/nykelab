#!/usr/bin/env node
// Works out where each library photo was made, as best it can, and writes data/library-geo.json for the loader.
// Everything it reads is read-only: the originals (exiftool, tags only), a COPY of the Photos library database
// (timestamps + coordinates only), and the offline GeoNames list the Worker already uses for upload autofill.
//
//   node scripts/geotag-library.mjs --phone phone-gps.json [--report]
//     --phone  JSON of [{t: unix seconds (UTC), tz: seconds east of UTC, lat, lon}], extracted from a copy of Photos.sqlite:
//              sqlite3 -readonly -json Photos.sqlite "select a.ZDATECREATED+978307200 as t, coalesce(x.ZTIMEZONEOFFSET,0) as tz,
//                a.ZLATITUDE as lat, a.ZLONGITUDE as lon from ZASSET a left join ZADDITIONALASSETATTRIBUTES x on x.ZASSET=a.Z_PK
//                where a.ZLATITUDE > -180 and a.ZLONGITUDE > -180 and a.ZTRASHEDSTATE=0"
//
// Each photo ends up with one of three sources, best first:
//   exif   the original carries GPS
//   phone  a phone photo with a location was taken within minutes, after finding that trip's camera-clock offset
//          (the cameras here have no GPS; their clocks are often an hour or twelve off)
//   trip   no coordinates: the place of the trip it belongs to (city, park or state)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

const { values: a } = parseArgs({
  options: {
    library: { type: "string", default: "/Volumes/Whiskey/resolve/LibraryGrade" },
    phone: { type: "string" },
    out: { type: "string", default: new URL("../data/library-geo.json", import.meta.url).pathname },
    report: { type: "boolean", default: false },
  },
});
if (!a.phone) throw new Error("--phone <phone-gps.json> is required (see the header of this file)");

const MIN = 60000, HOUR = 3600000, DAY = 86400000;
const photos = JSON.parse(fs.readFileSync(path.join(a.library, "photos/manifest.json"), "utf8")).photos;
const catalog = JSON.parse(fs.readFileSync(new URL("../src/data/catalog.json", import.meta.url), "utf8"));
const voyages = catalog.voyages;
const cityData = JSON.parse(fs.readFileSync(new URL("../../worker/src/cities.json", import.meta.url), "utf8"));
const phoneRaw = JSON.parse(fs.readFileSync(a.phone, "utf8"));
const phone = phoneRaw.map((p) => ({ ms: (p.t + (p.tz ?? 0)) * 1000, lat: p.lat, lon: p.lon })).sort((x, y) => x.ms - y.ms);

// ---- geometry + offline place lookup (same rule as worker/src/places.ts: biggest city within 20 km, else nearest) --------
const RAD = Math.PI / 180;
const km = (la1, lo1, la2, lo2) => Math.hypot((lo2 - lo1) * RAD * Math.cos(((la1 + la2) / 2) * RAD), (la2 - la1) * RAD) * 6371;
function nearestCity(lat, lon) {
  let best = -1, bestKm = Infinity;
  const close = [];
  cityData.cities.forEach((r, i) => {
    if (Math.abs(r[1] - lat) > 3 && bestKm < 330) return;
    const d = km(lat, lon, r[1], r[2]);
    if (d < bestKm) { bestKm = d; best = i; }
    if (d <= 20) close.push(i);
  });
  const i = close.length ? close.sort((x, y) => cityData.cities[y][5] - cityData.cities[x][5])[0] : best;
  const r = cityData.cities[i];
  return { name: r[0], country: cityData.countries[r[3]][1], cc: cityData.countries[r[3]][0], region: cityData.regions[r[4]] };
}
/** The plain nearest town (not the biggest one nearby), for deciding which state or country a point is in. */
function townAt(lat, lon) {
  let best = -1, bestKm = Infinity;
  cityData.cities.forEach((r, i) => {
    if (Math.abs(r[1] - lat) > 1) return;
    const d = km(lat, lon, r[1], r[2]);
    if (d < bestKm) { bestKm = d; best = i; }
  });
  if (best < 0) return { ...nearestCity(lat, lon), km: Infinity };
  const r = cityData.cities[best];
  return { name: r[0], country: cityData.countries[r[3]][1], cc: cityData.countries[r[3]][0], region: cityData.regions[r[4]], km: bestKm };
}
const placeName = (lat, lon) => {
  const c = nearestCity(lat, lon);
  return c.cc === "US" || c.cc === "CA" ? `${c.name}, ${c.region}` : `${c.name}, ${c.country}`;
};

// ---- 1. GPS the originals already carry ----------------------------------------------------------------------------------
const srcList = path.join(os.tmpdir(), "geotag-src.txt");
fs.writeFileSync(srcList, [...new Set(photos.map((p) => p.source_path))].join("\n"));
const tags = JSON.parse(execFileSync("exiftool", ["-q", "-m", "-json", "-n", "-fast2", "-GPSLatitude", "-GPSLongitude", "-Model", "-@", srcList], { maxBuffer: 1 << 28 }).toString());
const exif = new Map(
  tags.filter((x) => x.GPSLatitude != null && x.GPSLongitude != null && !(x.GPSLatitude === 0 && x.GPSLongitude === 0)).map((x) => [x.SourceFile, { lat: x.GPSLatitude, lon: x.GPSLongitude }]),
);
const modelOf = new Map(tags.map((x) => [x.SourceFile, x.Model ?? "?"]));
fs.rmSync(srcList);

// ---- 2. trips: which catalogue voyage a date belongs to ------------------------------------------------------------------
const wall = (s) => Date.parse(`${s}Z`); // "2021-12-17T05:13:13" as a wall-clock number
// The catalogue's voyages can span years (New York is one entry from 2020 to 2025) and overlap (London and Iceland share a day),
// so a trip is judged by its own shots: the voyage whose shots are nearest in time, and the trips with a shot within two days.
const shotsOf = voyages.map(() => []);
for (const r of catalog.shots) shotsOf[r[0]].push(r[1] * 60000);
shotsOf.forEach((l) => l.sort((x, y) => x - y));
const nearestGap = (list, ms) => {
  let lo = 0, hi = list.length;
  while (lo < hi) { const m = (lo + hi) >> 1; list[m] < ms ? (lo = m + 1) : (hi = m); }
  return Math.min(Math.abs((list[lo] ?? Infinity) - ms), Math.abs((list[lo - 1] ?? Infinity) - ms));
};
const voyageAt = (ms) => {
  let best = null, bestGap = Infinity;
  voyages.forEach((v, i) => { const g = nearestGap(shotsOf[i], ms); if (g < bestGap || (g === bestGap && best && v.end - v.start < best.end - best.start)) { bestGap = g; best = v; } });
  return bestGap <= 2 * DAY ? best : null; // a day or two of slack for clocks that are off
};
// A trip named for a state or country (no comma in its place) covers far more ground than one named for a city.
const reach = (v) => (v.place.includes(",") ? 250 : 700);
const tripsAt = (ms) => voyages.filter((v, i) => nearestGap(shotsOf[i], ms) <= 2 * DAY);
const items = photos.map((p) => ({ p, ms: p.capture ? wall(p.capture) : NaN })).map((x) => ({ ...x, v: Number.isNaN(x.ms) ? null : voyageAt(x.ms) }));

// ---- 3. camera clock offset per episode, found against the phone's own photos ----------------------------------------------
// An episode is a run of photos with no gap over 36 h. For each candidate offset (-15h..+15h, every 15 min) count the photos
// that have a phone photo within 4 min, with the phone photo inside 250 km of the trip. The best offset wins if it explains
// at least two photos (or one that matches with no offset at all).
const byTime = items.filter((x) => !Number.isNaN(x.ms)).sort((x, y) => x.ms - y.ms);
const episodes = [];
for (const it of byTime) {
  const last = episodes.at(-1);
  if (last && it.ms - last.at(-1).ms <= 36 * HOUR) last.push(it);
  else episodes.push([it]);
}
const lowerBound = (ms) => { let lo = 0, hi = phone.length; while (lo < hi) { const m = (lo + hi) >> 1; phone[m].ms < ms ? (lo = m + 1) : (hi = m); } return lo; };
// `gates` are the trips covering the photo's date (250 km around each); a phone photo must be near one of them.
function nearbyPhone(ms, tol, gates) {
  let best = null;
  for (let i = lowerBound(ms - tol); i < phone.length && phone[i].ms <= ms + tol; i++) {
    const q = phone[i];
    if (!gates || !gates.some((g) => km(q.lat, q.lon, g.lat, g.lon) <= reach(g))) continue;
    if (!best || Math.abs(q.ms - ms) < Math.abs(best.ms - ms)) best = q;
  }
  return best;
}
const result = new Map(); // manifest id -> geo
const offsets = [];
const analysed = episodes.map((ep) => {
  for (const it of ep) it.gates = tripsAt(it.ms).length ? tripsAt(it.ms) : null;
  const gate = ep.some((it) => it.gates);
  const model = [...ep.reduce((m, it) => m.set(modelOf.get(it.p.source_path), (m.get(modelOf.get(it.p.source_path)) ?? 0) + 1), new Map())].sort((x, y) => y[1] - x[1])[0][0];
  let best = { d: 0, score: 0 };
  const scoreOf = new Map();
  if (gate) {
    for (let d = -15 * HOUR; d <= 15 * HOUR; d += 15 * MIN) {
      let s = 0;
      for (const it of ep) if (nearbyPhone(it.ms + d, 3 * MIN, it.gates)) s++;
      scoreOf.set(d, s);
      if (s > best.score || (s === best.score && s > 0 && Math.abs(d) < Math.abs(best.d))) best = { d, score: s };
    }
  }
  // a rival offset that explains nearly as much (and is not next door) means the answer is a guess
  const rival = [...scoreOf].some(([d, s]) => Math.abs(d - best.d) > HOUR && s >= Math.max(2, best.score * 0.8));
  const vals = [...scoreOf.values()].sort((x, y) => x - y);
  const second = [...scoreOf].filter(([d]) => Math.abs(d - best.d) > HOUR).reduce((m, [, v]) => Math.max(m, v), 0);
  return { ep, gate, model, best, rival, at: ep[0].ms, second, p90: vals[Math.floor(vals.length * 0.9)] ?? 0 };
});
// An offset is trusted when its own episode backs it overwhelmingly (8+ photos explained, or every photo of a run of 5+), or when
// it is a clock error already established for the same camera within about a year (a clock stays wrong the same way for months).
// Short bursts of photos can line up with some phone burst on a random day, so anything weaker is left at the trip's place.
const TOL = 3 * MIN;
if (a.report) for (const e of analysed.filter((x) => x.ep.length >= 6)) console.log(`  episode ${new Date(e.at).toISOString().slice(0, 10)} n=${e.ep.length} ${e.model} best ${e.best.d / MIN} min x${e.best.score} second x${e.second} p90 ${e.p90}${e.rival ? " RIVAL" : ""}`);
const strong = analysed.filter((e) => !e.rival && ((e.best.score >= 8 && e.best.score >= e.ep.length * 0.25) || (e.best.score >= 5 && e.best.score === e.ep.length)));
for (const e of analysed) {
  let d = null, hit = 0, approx = false;
  if (strong.includes(e)) ({ d, score: hit } = { d: e.best.d, score: e.best.score });
  else if (e.best.score >= 8 && e.best.score >= e.ep.length * 0.25) ({ d, score: hit, approx } = { d: e.best.d, score: e.best.score, approx: true }); // several offsets fit: same venue, coarser coordinates
  else if (e.gate) {
    for (const pr of strong) {
      if (pr.model !== e.model || Math.abs(pr.at - e.at) > 400 * DAY) continue;
      let s = 0;
      for (const it of e.ep) if (nearbyPhone(it.ms + pr.best.d, TOL, it.gates)) s++;
      if (s > hit && (s >= 2 || (s === 1 && e.ep.length <= 3)) && s >= e.ep.length * 0.25) ({ d, hit } = { d: pr.best.d, hit: s });
    }
  }
  if (d === null) continue;
  offsets.push({ from: new Date(e.at).toISOString().slice(0, 10), n: e.ep.length, d: d / MIN, hit, model: e.model, own: strong.includes(e), approx });
  for (const it of e.ep) {
    it.shift = d; // this camera's clock error, so the photo's real date is known even without a phone photo beside it
    const q = nearbyPhone(it.ms + d, 12 * MIN, it.gates);
    if (q) result.set(it.p.id, { lat: q.lat, lon: q.lon, source: approx ? "phone-approx" : "phone", gapMin: Math.round(Math.abs(q.ms - (it.ms + d)) / MIN) });
  }
}
for (const it of items) {
  const g = exif.get(it.p.source_path);
  if (g) result.set(it.p.id, { lat: g.lat, lon: g.lon, source: "exif", gapMin: 0 });
}

// ---- 4. keep exact coordinates away from where the photographer lives -----------------------------------------------------
// The densest night-time spots in the phone library are home: photos made there keep their city, not their coordinates.
const cell = (lat, lon) => `${Math.round(lat / 0.004)},${Math.round(lon / 0.004)}`;
const night = new Map();
for (const q of phone) {
  const h = new Date(q.ms).getUTCHours();
  if (h < 22 && h >= 6) continue;
  const k = cell(q.lat, q.lon);
  const e = night.get(k) ?? { n: 0, lat: q.lat, lon: q.lon };
  e.n++;
  night.set(k, e);
}
const homes = [...night.values()].sort((x, y) => y.n - x.n).slice(0, 3);
const nearHome = (lat, lon) => homes.some((h) => km(lat, lon, h.lat, h.lon) < 0.8);

// ---- 5. naming: landmarks, collections, and where the phone was that day -------------------------------------------------------
const landmarks = JSON.parse(fs.readFileSync(new URL("./../data/landmarks.json", import.meta.url), "utf8"));
const named = landmarks.places.filter((l) => !l.city); // parks and venues that may name a point
const landmarkAt = (lat, lon) => named.map((l) => ({ l, r: km(lat, lon, l.lat, l.lon) / l.radiusKm })).filter((x) => x.r <= 1).sort((x, y) => x.r - y.r)[0]?.l ?? null;
const landmarkByName = new Map(landmarks.places.map((l) => [l.name, l]));
const byEye = JSON.parse(fs.readFileSync(new URL("../data/photo-places.json", import.meta.url), "utf8")).photos; // places named by looking at the photograph

// where the phone spent each local day: the busiest 5 km cell among the day's points that lie in the trip's region
const phoneByDay = new Map();
for (const q of phone) {
  const day = new Date(q.ms).toISOString().slice(0, 10);
  (phoneByDay.get(day) ?? phoneByDay.set(day, []).get(day)).push(q);
}
const regionOf = (v) => v.place.split(", ").at(-1); // "Sedona, Arizona" -> Arizona; "New Jersey" -> New Jersey; "Norway" -> Norway
const stateLevel = (v) => !v.place.includes(",");
const inRegion = (q, v) => {
  const d = km(q.lat, q.lon, v.lat, v.lon);
  if (d > reach(v)) return false;
  const c = townAt(q.lat, q.lon);
  const want = regionOf(v);
  if (c.km > 60) return stateLevel(v); // no listed town nearby (the list stops at 15,000 people): within reach is all we can say
  if (stateLevel(v)) return c.region === want || c.country === want; // New Jersey means New Jersey, not the Manhattan next door
  return c.region === want || c.country === want || v.place.includes(c.name) || d <= 40;
};
const countryLevel = (v) => stateLevel(v) && townAt(v.lat, v.lon).country === v.place; // Norway, Iceland: no single place to pin
const SMALL_AREAS = new Set(["New Jersey"]); // a state small enough that one pin is fair; Texas or Colorado are not
const pinnable = (v) => !stateLevel(v) || SMALL_AREAS.has(v.place);
function dayStop(v, day) {
  const pts = (phoneByDay.get(day) ?? []).filter((q) => inRegion(q, v));
  if (pts.length < 3) return null;
  const cells = new Map();
  for (const q of pts) { const k = `${Math.round(q.lat / 0.05)},${Math.round(q.lon / 0.05)}`; (cells.get(k) ?? cells.set(k, []).get(k)).push(q); }
  const top = [...cells.values()].sort((x, y) => y.length - x.length)[0];
  if (top.length < 3 || top.length / pts.length < 0.8) return null; // a day spent in two places is not pinned to either
  const lat = top.reduce((n, q) => n + q.lat, 0) / top.length, lon = top.reduce((n, q) => n + q.lon, 0) / top.length;
  return nearHome(lat, lon) ? null : { lat, lon };
}

// A voyage is one page. Its slug is the catalogue slug, or the title where two voyages share one (Wyoming 2020 / 2022).
const slugCount = {};
for (const v of voyages) slugCount[v.slug] = (slugCount[v.slug] ?? 0) + 1;
const slugify = (t) => t.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const collectionOf = (v) => (slugCount[v.slug] > 1 ? slugify(v.title) : v.slug);
const round = (x, dec) => Math.round(x * 10 ** dec) / 10 ** dec;

const out = { note: "Generated by scripts/geotag-library.mjs. Coordinates: 3 decimals (about 100 m) when matched to a phone photo or the photo's own GPS, 2 (about 1 km) when approximate.", photos: {} };
const stats = { exif: 0, phone: 0, "phone-approx": 0, day: 0, trip: 0, none: 0, homeHidden: 0 };
for (const it of items) {
  const dir = it.p.id.split("/")[0];
  const g = result.get(it.p.id);
  const v = it.v;
  const base = { collection: v ? collectionOf(v) : null, title: v?.title ?? null, trip: v?.place ?? null };
  let rec = null;
  if (g) {
    const hide = nearHome(g.lat, g.lon);
    const closest = (it.gates ?? []).map((t) => ({ t, d: km(g.lat, g.lon, t.lat, t.lon) })).sort((x, y) => x.d - y.d)[0];
    const near = closest && closest.d <= 60 ? closest.t : null;
    const exact = g.source !== "phone-approx";
    const lm = landmarkAt(g.lat, g.lon);
    // far from any listed town (and inside a state-level trip's reach): the trip's own name beats a wrong neighbour
    const lone = closest && townAt(g.lat, g.lon).km > 60 && closest.d <= reach(closest.t) ? closest.t : null;
    rec = { lat: hide ? null : round(g.lat, exact ? 3 : 2), lon: hide ? null : round(g.lon, exact ? 3 : 2), source: g.source, place: lm?.name ?? (near ?? lone)?.place ?? placeName(g.lat, g.lon) };
    if (hide) stats.homeHidden++;
  } else if (v) {
    // no coordinates of its own: the folder's own name when it names a place, else where the phone was that day, else the trip
    const hintName = byEye[it.p.id] ?? landmarks.collections[dir];
    const hint = hintName && landmarkByName.get(hintName);
    const day = new Date(it.ms + (it.shift ?? 0)).toISOString().slice(0, 10);
    const stop = hint ? null : dayStop(v, day);
    if (hint) rec = { lat: round(hint.lat, 2), lon: round(hint.lon, 2), source: "day", place: hint.name };
    else if (stop) {
      const lm = landmarkAt(stop.lat, stop.lon);
      const near = km(stop.lat, stop.lon, v.lat, v.lon) <= 40;
      rec = { lat: round(stop.lat, 2), lon: round(stop.lon, 2), source: "day", place: lm?.name ?? (near ? v.place : placeName(stop.lat, stop.lon)) };
    } else rec = pinnable(v) ? { lat: round(v.lat, 2), lon: round(v.lon, 2), source: "trip", place: v.place } : { lat: null, lon: null, source: "trip", place: v.place };
  }
  if (rec) { out.photos[it.p.id] = { ...rec, ...base }; stats[rec.source]++; }
  else stats.none++;
}
// one page per voyage: its title, its place, and an approximate pin (none for a whole country)
out.collections = {};
voyages.forEach((v, i) => {
  out.collections[collectionOf(v)] = { title: v.title, place: v.place, lat: pinnable(v) ? round(v.lat, 2) : null, lon: pinnable(v) ? round(v.lon, 2) : null, order: i };
});
fs.mkdirSync(path.dirname(a.out), { recursive: true });
fs.writeFileSync(a.out, JSON.stringify(out) + "\n");
console.log(`photos ${photos.length}:`, JSON.stringify(stats), `| homes found ${homes.length}`);
if (a.report) {
  console.log("episodes with a clock offset:", offsets.length, "of", episodes.length);
  for (const o of offsets) console.log(`  ${o.from}  ${String(o.n).padStart(3)} photos  offset ${String(o.d).padStart(5)} min  explained ${o.hit}  ${o.model}${o.approx ? "  (approximate)" : o.own ? "" : "  (camera's known offset)"}`);
  const byV = {};
  for (const it of items) { const k = it.v?.slug ?? "(no trip)"; const s = out.photos[it.p.id]?.source ?? "none"; byV[k] ??= {}; byV[k][s] = (byV[k][s] ?? 0) + 1; }
  for (const [k, v] of Object.entries(byV)) console.log(k.padEnd(18), JSON.stringify(v));
}
