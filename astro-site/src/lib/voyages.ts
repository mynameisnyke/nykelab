// Metadata model for the home visualization + a SAMPLE data generator.
//
// Real data will come from EXIF read at upload (DateTimeOriginal, GPS, focal length,
// aperture, ISO, shutter, lens). Until existing photos are re-uploaded with originals
// there is none, so `buildSample()` invents plausible values to design against.
// Everything below `buildSample` is data-source agnostic and works on real rows too.

export interface Voyage {
  slug: string;
  title: string;
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
  /** Index into PreviewImage[] used as the voyage's cover. */
  cover: number;
}

export interface Shot {
  id: string;
  v: number; // index into Voyage[]
  t: number; // capture time, epoch ms
  hour: number; // local solar hour of day, 0–24
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

// ---- SAMPLE generator -----------------------------------------------------------

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Theme = "nature" | "city";
interface Seed {
  slug: string;
  title: string;
  placeSlug: string;
  placeName: string;
  place: string;
  country: string;
  lat: number;
  lon: number;
  start: string; // ISO date
  days: number;
  count: number;
  theme: Theme;
}

// Real places; made-up trips. Colors read on both the dark and the light theme.
const SEEDS: Seed[] = [
  { slug: "westminster", placeSlug: "new-york", placeName: "New York", title: "Westminster", place: "Madison Square Garden, New York", country: "United States", lat: 40.7505, lon: -73.9934, start: "2025-02-10", days: 3, count: 22, theme: "city" },
  { slug: "grand-tetons", placeSlug: "wyoming", placeName: "Wyoming", title: "Grand Tetons", place: "Grand Teton National Park, Wyoming", country: "United States", lat: 43.79, lon: -110.68, start: "2025-10-04", days: 9, count: 34, theme: "nature" },
  { slug: "yellowstone", placeSlug: "wyoming", placeName: "Wyoming", title: "Yellowstone", place: "Yellowstone National Park, Wyoming", country: "United States", lat: 44.46, lon: -110.83, start: "2025-09-14", days: 6, count: 26, theme: "nature" },
  { slug: "new-york", placeSlug: "new-york", placeName: "New York", title: "New York", place: "Long Island City, New York", country: "United States", lat: 40.7447, lon: -73.9485, start: "2024-12-02", days: 20, count: 30, theme: "city" },
  { slug: "arizona", placeSlug: "arizona", placeName: "Arizona", title: "Arizona", place: "Page, Arizona", country: "United States", lat: 36.914, lon: -111.456, start: "2024-03-21", days: 5, count: 18, theme: "nature" },
  { slug: "iceland", placeSlug: "iceland", placeName: "Iceland", title: "Iceland", place: "Snæfellsnes, Iceland", country: "Iceland", lat: 64.85, lon: -23.0, start: "2024-08-12", days: 8, count: 24, theme: "nature" },
  { slug: "kyoto", placeSlug: "kyoto", placeName: "Kyoto", title: "Kyoto", place: "Kyoto, Japan", country: "Japan", lat: 35.01, lon: 135.77, start: "2023-11-14", days: 7, count: 20, theme: "city" },
  { slug: "lofoten", placeSlug: "lofoten", placeName: "Lofoten", title: "Lofoten", place: "Lofoten, Norway", country: "Norway", lat: 68.2, lon: 13.6, start: "2023-01-20", days: 6, count: 16, theme: "nature" },
];

const COLORS = ["#d9a05b", "#5fa8d3", "#d9776a", "#7fbf7b", "#a98be0", "#d6c35a", "#4fbfae", "#d98bb0"];

const LENSES = [
  { name: "24–70 f/2.8", focals: [24, 28, 35, 50, 70], aps: [2.8, 4, 5.6, 8, 11] },
  { name: "70–200 f/2.8", focals: [70, 100, 135, 200], aps: [2.8, 4, 5.6, 8] },
  { name: "16–35 f/4", focals: [16, 20, 24, 35], aps: [4, 5.6, 8, 11, 16] },
  { name: "100–400 f/5.6", focals: [150, 200, 300, 400], aps: [5.6, 8, 11] },
];
const SHUTTERS = ["1/4000", "1/2000", "1/1000", "1/500", "1/250", "1/125", "1/60", "1/30", "1/15", "1s"];

export function buildSample(imageCount: number, coverFor: (theme: Theme, i: number) => number): { voyages: Voyage[]; shots: Shot[] } {
  const rnd = mulberry32(20261024);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const voyages: Voyage[] = [];
  const shots: Shot[] = [];

  SEEDS.forEach((s, vi) => {
    const start = Date.parse(s.start + "T00:00:00Z");
    voyages.push({
      slug: s.slug,
      title: s.title,
      placeSlug: s.placeSlug,
      placeName: s.placeName,
      place: s.place,
      country: s.country,
      lat: s.lat,
      lon: s.lon,
      color: COLORS[vi % COLORS.length],
      start,
      end: start + (s.days - 1) * 86400000,
      count: s.count,
      available: false,
      cover: coverFor(s.theme, vi),
    });
    for (let i = 0; i < s.count; i++) {
      const day = Math.floor(rnd() * s.days);
      const t0 = start + day * 86400000;
      const { rise, set } = sunTimes(s.lat, t0);
      // Photographers cluster around golden hour; the rest scatters through the day.
      const r = rnd();
      let hour: number;
      if (r < 0.34) hour = rise + (rnd() - 0.35) * 1.8;
      else if (r < 0.74) hour = set + (rnd() - 0.65) * 1.8;
      else hour = rise + 2 + rnd() * (set - rise - 3);
      hour = Math.min(23.9, Math.max(0, hour));
      const lens = rnd() < 0.5 ? LENSES[1] : rnd() < 0.6 ? LENSES[0] : rnd() < 0.5 ? LENSES[2] : LENSES[3];
      const focal = pick(lens.focals);
      const f = pick(lens.aps);
      const jitter = () => (rnd() - 0.5) * (s.theme === "city" ? 0.05 : 0.5);
      shots.push({
        id: `${s.slug}-${i}`,
        v: vi,
        t: t0 + Math.round(hour * 3600000),
        hour,
        lat: s.lat + jitter(),
        lon: s.lon + jitter(),
        focal,
        f,
        iso: pick([100, 100, 100, 200, 400, 800, 1600, 3200]),
        shutter: pick(SHUTTERS),
        lens: lens.name,
        img: coverFor(s.theme, vi * 100 + i) % Math.max(1, imageCount),
      });
    }
  });
  return { voyages, shots };
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

export function derivePlaces(voyages: Voyage[]): Place[] {
  const by = new Map<string, number[]>();
  voyages.forEach((v, i) => by.set(v.placeSlug, [...(by.get(v.placeSlug) ?? []), i]));
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
      cover: biggest.cover,
      available: false,
    });
  }
  return places.sort((a, b) => b.count - a.count);
}

export function deriveYears(voyages: Voyage[], shots: Shot[], imageCount: number): YearSummary[] {
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
    const photos = [...new Set(list.map((s) => s.img))].slice(0, 6);
    for (let k = 0; photos.length < Math.min(6, imageCount) && k < imageCount; k++) {
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
