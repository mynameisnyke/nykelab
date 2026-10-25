// Metadata model for the home visualization, Places and Years.
//
// The data comes from the Lightroom catalog: `npm run catalog` turns the exported CSV into
// src/data/catalog.json, and src/lib/catalog.ts loads it into the shapes below. Everything in
// this file is data-source agnostic.

export type Theme = "nature" | "city";
export type VoyageKind = "trip" | "home" | "event";

export interface Voyage {
  slug: string;
  title: string;
  kind: VoyageKind;
  /** Events only: the recurring event this edition belongs to ("westminster", "nycc"). */
  series?: string;
  place: string; // "Grand Teton National Park, Wyoming"
  /** The Place this voyage belongs to (several voyages can share one: Tetons + Yellowstone → Wyoming). */
  placeSlug: string;
  placeName: string;
  country: string;
  lat: number;
  lon: number;
  color: string;
  start: number; // epoch ms
  end: number;
  count: number;
  /** A published collection with this slug exists, so the voyage links to a page. */
  available: boolean;
  /** Slug of the published collection that holds this voyage's photographs (what "Open voyage" links to). */
  collection?: string;
  /** Index into PreviewImage[] used as the voyage's cover; -1 when no photograph of this voyage is published. */
  cover: number;
}

export interface Shot {
  id: string;
  v: number; // index into Voyage[]
  t: number; // capture time, epoch ms
  hour: number; // local SOLAR hour of day, 0–24 (sun maths: golden hour, the When chart)
  clock: number; // local wall-clock hour of day, 0–24, after clock correction (what captions show)
  lat: number;
  lon: number;
  focal: number; // mm
  f: number; // aperture
  iso: number;
  shutter: string;
  lens: string;
  img: number; // index into PreviewImage[]
}

export interface PreviewImage {
  src: string;
  srcset?: string;
  w: number;
  h: number;
  alt: string;
  /** Year of the collection this photo belongs to, so previews can match the year they sit under. */
  year?: number;
}

export interface HomeData {
  voyages: Voyage[];
  shots: Shot[];
  images: PreviewImage[];
  sample: boolean;
}

// ---- helpers (shared by server + client) ----------------------------------------

const RAD = Math.PI / 180;

/** Approximate sunrise/sunset in local SOLAR hours for a latitude and date. */
export function sunTimes(latDeg: number, t: number): { rise: number; set: number } {
  const d = new Date(t);
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const n = Math.floor((t - start) / 86400000);
  const decl = 23.44 * RAD * Math.sin(((2 * Math.PI) / 365) * (284 + n));
  const x = -Math.tan(latDeg * RAD) * Math.tan(decl);
  const h0 = (Math.acos(Math.min(1, Math.max(-1, x))) / RAD) / 15; // half-day length in hours
  return { rise: 12 - h0, set: 12 + h0 };
}

/** Minutes from the nearest sunrise/sunset. */
export function goldenOffsetMin(s: Pick<Shot, "lat" | "t" | "hour">): number {
  const { rise, set } = sunTimes(s.lat, s.t);
  return Math.min(Math.abs(s.hour - rise), Math.abs(s.hour - set)) * 60;
}

export const isGolden = (s: Shot) => goldenOffsetMin(s) <= 60;

export function latLonToVec(lat: number, lon: number, r = 1): [number, number, number] {
  const phi = lat * RAD;
  const lam = lon * RAD;
  return [r * Math.cos(phi) * Math.sin(lam), r * Math.sin(phi), r * Math.cos(phi) * Math.cos(lam)];
}

/** 6,678 */
export const fmtN = (n: number) => n.toLocaleString("en-US");
export const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
export const fmtMonthYear = (t: number) =>
  new Date(t).toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
export const fmtHour = (h: number) => {
  const m = Math.round(h * 60);
  const hh = Math.floor(m / 60) % 24;
  const mm = m % 60;
  const ap = hh >= 12 ? "pm" : "am";
  return `${hh % 12 === 0 ? 12 : hh % 12}:${String(mm).padStart(2, "0")} ${ap}`;
};

// ---- compact transport (home page JSON) -----------------------------------------------------

/** [voyage, minutes since epoch, solar hour x100, clock hour x100, focal, f, iso, shutter, lens index, image index] */
export type ShotRow = [number, number, number, number, number, number, number, string, number, number];
export interface PackedHome {
  voyages: Voyage[];
  images: PreviewImage[];
  lenses: string[];
  rows: ShotRow[];
  sample: boolean;
}

export function packHome(d: HomeData, lenses: string[]): PackedHome {
  const rows = d.shots.map((s): ShotRow => [s.v, Math.round(s.t / 60000), Math.round(s.hour * 100), Math.round(s.clock * 100), s.focal, s.f, s.iso, s.shutter, lenses.indexOf(s.lens), s.img]);
  return { voyages: d.voyages, images: d.images, lenses, rows, sample: d.sample };
}

export function unpackHome(p: PackedHome): HomeData {
  const shots = p.rows.map(
    (r, i): Shot => ({
      id: String(i),
      v: r[0],
      t: r[1] * 60000,
      hour: r[2] / 100,
      clock: r[3] / 100,
      lat: p.voyages[r[0]].lat,
      lon: p.voyages[r[0]].lon,
      focal: r[4],
      f: r[5],
      iso: r[6],
      shutter: r[7],
      lens: p.lenses[r[8]] ?? "",
      img: r[9],
    }),
  );
  return { voyages: p.voyages, shots, images: p.images, sample: p.sample };
}

// ---- summaries -----------------------------------------------------------------

export function summarize(voyages: Voyage[], shots: Shot[]) {
  const countries = new Set(voyages.map((v) => v.country));
  const years = shots.map((s) => new Date(s.t).getUTCFullYear());
  return {
    voyages: voyages.length,
    photos: shots.length,
    countries: countries.size,
    from: Math.min(...years),
    to: Math.max(...years),
  };
}

export function goldenShare(shots: Shot[]): number {
  return shots.length ? shots.filter(isGolden).length / shots.length : 0;
}

export function topSetting(shots: Shot[]): { focal: number; f: number; share: number } | null {
  if (!shots.length) return null;
  const m = new Map<string, number>();
  for (const s of shots) m.set(`${s.focal}|${s.f}`, (m.get(`${s.focal}|${s.f}`) ?? 0) + 1);
  const [key, n] = [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  const [focal, f] = key.split("|").map(Number);
  return { focal, f, share: n / shots.length };
}

// ---- archive: Places and Years derived from voyages + shots -------------------------

export interface Place {
  slug: string;
  name: string;
  country: string;
  lat: number;
  lon: number;
  count: number;
  start: number;
  end: number;
  voyages: number[];
  /** Index into PreviewImage[] (the cover of the place's largest voyage). */
  cover: number;
  /** A gallery page exists for this place (any of its voyages has a page). */
  available: boolean;
}

/** A recurring event with its editions (voyages of kind "event"), oldest first. */
export interface EventSeries {
  slug: string;
  name: string;
  about: string;
  editions: number[]; // indices into Voyage[]
  count: number;
  start: number;
  end: number;
  /** Index into PreviewImage[] (the cover of the largest edition). */
  cover: number;
}

export function deriveEvents(voyages: Voyage[], info: Record<string, { name: string; about: string }>): EventSeries[] {
  const by = new Map<string, number[]>();
  voyages.forEach((v, i) => v.series && by.set(v.series, [...(by.get(v.series) ?? []), i]));
  return [...by.entries()]
    .map(([slug, idxs]) => {
      const eds = idxs.sort((a, b) => voyages[a].start - voyages[b].start).map((i) => voyages[i]);
      const biggest = eds.reduce((a, b) => (b.count > a.count ? b : a));
      return {
        slug,
        name: info[slug]?.name ?? slug,
        about: info[slug]?.about ?? "",
        editions: idxs,
        count: eds.reduce((n, v) => n + v.count, 0),
        start: Math.min(...eds.map((v) => v.start)),
        end: Math.max(...eds.map((v) => v.end)),
        cover: coverOf(eds, biggest),
      };
    })
    .sort((a, b) => b.count - a.count);
}

export interface YearSummary {
  year: number;
  count: number;
  voyages: number[];
  countries: string[];
  top: { focal: number; f: number; share: number } | null;
  monthCounts: number[]; // 12
  monthVoyage: (number | null)[]; // dominant voyage per month
  /** Preview image indices for the contact strip. */
  photos: number[];
  start: number;
  end: number;
}

/** The biggest voyage's cover, or the biggest cover-bearing voyage of the group; -1 when none has a photograph. */
function coverOf(vs: Voyage[], biggest: Voyage): number {
  if (biggest.cover >= 0) return biggest.cover;
  return vs.filter((v) => v.cover >= 0).sort((a, b) => b.count - a.count)[0]?.cover ?? -1;
}

/** Places the voyages roll up into. `include` keeps indices into the full list (shots refer to them), e.g. to leave events off the map. */
export function derivePlaces(voyages: Voyage[], include: (v: Voyage) => boolean = () => true): Place[] {
  const by = new Map<string, number[]>();
  voyages.forEach((v, i) => include(v) && by.set(v.placeSlug, [...(by.get(v.placeSlug) ?? []), i]));
  const places: Place[] = [];
  for (const [slug, idxs] of by) {
    const vs = idxs.map((i) => voyages[i]);
    const count = vs.reduce((n, v) => n + v.count, 0);
    const biggest = vs.reduce((a, b) => (b.count > a.count ? b : a));
    places.push({
      slug,
      name: biggest.placeName,
      country: biggest.country,
      lat: vs.reduce((n, v) => n + v.lat * v.count, 0) / count,
      lon: vs.reduce((n, v) => n + v.lon * v.count, 0) / count,
      count,
      start: Math.min(...vs.map((v) => v.start)),
      end: Math.max(...vs.map((v) => v.end)),
      voyages: idxs,
      cover: coverOf(vs, biggest),
      available: false,
    });
  }
  return places.sort((a, b) => b.count - a.count);
}

export function deriveYears(voyages: Voyage[], shots: Shot[], imageCount: number, images: PreviewImage[] = []): YearSummary[] {
  const by = new Map<number, Shot[]>();
  for (const s of shots) {
    const y = new Date(s.t).getUTCFullYear();
    by.set(y, [...(by.get(y) ?? []), s]);
  }
  const out: YearSummary[] = [];
  for (const [year, list] of by) {
    const monthCounts = new Array(12).fill(0);
    const perMonthVoyage = Array.from({ length: 12 }, () => new Map<number, number>());
    for (const s of list) {
      const m = new Date(s.t).getUTCMonth();
      monthCounts[m]++;
      perMonthVoyage[m].set(s.v, (perMonthVoyage[m].get(s.v) ?? 0) + 1);
    }
    const monthVoyage = perMonthVoyage.map((mp) => (mp.size ? [...mp.entries()].sort((a, b) => b[1] - a[1])[0][0] : null));
    const vIdx = [...new Set(list.map((s) => s.v))];
    const photos = [...new Set(list.map((s) => s.img).filter((i) => i >= 0 && (!images[i]?.year || images[i].year === year)))].slice(0, 6);
    // Top up from photos of the same year; only borrow other years when the pool has none for this one.
    const sameYear = images.flatMap((im, j) => (im.year === year ? [j] : []));
    const pool = sameYear.length || !images.some((im) => im.year) ? sameYear : [];
    for (const j of pool) if (photos.length < 6 && !photos.includes(j)) photos.push(j);
    for (let k = 0; !pool.length && photos.length < Math.min(6, imageCount) && k < imageCount; k++) {
      const j = (k + year * 3) % imageCount; // offset by year so strips don't all start the same
      if (!photos.includes(j)) photos.push(j);
    }
    out.push({
      year,
      count: list.length,
      voyages: vIdx,
      countries: [...new Set(vIdx.map((i) => voyages[i].country))],
      top: topSetting(list),
      monthCounts,
      monthVoyage,
      photos,
      start: Math.min(...list.map((s) => s.t)),
      end: Math.max(...list.map((s) => s.t)),
    });
  }
  return out.sort((a, b) => b.year - a.year);
}

/** "AUG 2024" · "SEP – OCT 2025" · "DEC 2024 – FEB 2025" */
export function fmtSpan(start: number, end: number): string {
  const a = new Date(start), b = new Date(end);
  const mon = (d: Date) => d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  const ay = a.getUTCFullYear(), by = b.getUTCFullYear();
  if (ay === by && a.getUTCMonth() === b.getUTCMonth()) return `${mon(a)} ${ay}`;
  if (ay === by) return `${mon(a)} – ${mon(b)} ${ay}`;
  return `${mon(a)} ${ay} – ${mon(b)} ${by}`;
}

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
export const words = (n: number) => WORDS[n] ?? String(n);

// ---- galleries -----------------------------------------------------------------------

const isPortrait = (im: PreviewImage | undefined) => !!im && im.h > im.w;

/** A landscape image for full-bleed heroes (falls back to whatever exists). */
export function heroImage(images: PreviewImage[], preferred: number, candidates: number[] = []): number {
  if (!images[preferred] || !isPortrait(images[preferred])) return preferred; // -1 / missing: no hero, never someone else's
  // The wide hero crops a portrait hard: look for a landscape among this page's own photographs only.
  return candidates.find((i) => images[i] && !isPortrait(images[i])) ?? preferred;
}

/** Up to `n` shots from a voyage with distinct photographs, portraits first (rows are portrait tiles). */
export function pickPhotos(shots: Shot[], images: PreviewImage[], voyage: number, n: number): Shot[] {
  const mine = shots.filter((s) => s.v === voyage).sort((a, b) => a.t - b.t);
  const seen = new Set<number>();
  const out: Shot[] = [];
  for (const wantPortrait of [true, false])
    for (const s of mine) {
      if (out.length >= n) break;
      if (seen.has(s.img) || !images[s.img] || isPortrait(images[s.img]) !== wantPortrait) continue;
      seen.add(s.img);
      out.push(s);
    }
  return out.sort((a, b) => a.t - b.t);
}

/** "Oct 4, 2025 · 5:43 am · 50mm f/8" — the metadata line under a photograph. */
export const metaLine = (s: Shot) => `${fmtDate(s.t)} · ${fmtHour(s.clock)} · ${s.focal}mm f/${s.f}`;
