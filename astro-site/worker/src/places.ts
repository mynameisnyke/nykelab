// Offline place lookup over src/cities.json (GeoNames cities15000, CC BY 4.0): nearest city to a GPS fix, or the
// coordinates of a city named in a photo's IPTC/XMP tags. City-level on purpose: exact GPS never leaves the Worker.
import data from "./cities.json" with { type: "json" }; // the worker lives in an ESM package now; Node (Playwright) requires the attribute

type Row = [name: string, lat: number, lon: number, cc: number, region: number, popK: number];
const cities = data.cities as Row[];
const countries = data.countries as [string, string, string][]; // [ISO2, name, ISO3]
const regions = data.regions as string[];

export interface City {
  name: string;
  region: string;
  country: string;
  countryCode: string;
  lat: number;
  lon: number;
  popK: number;
}
const toCity = (r: Row): City => ({ name: r[0], lat: r[1], lon: r[2], popK: r[5], region: regions[r[4]], country: countries[r[3]][1], countryCode: countries[r[3]][0] });

/** Lowercase, no accents or punctuation: "Medellín" and "medellin" compare equal. */
export const fold = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

const RAD = Math.PI / 180;
function km(lat1: number, lon1: number, lat2: number, lon2: number) {
  const x = (lon2 - lon1) * RAD * Math.cos(((lat1 + lat2) / 2) * RAD);
  const y = (lat2 - lat1) * RAD;
  return Math.hypot(x, y) * 6371;
}

/**
 * The city a point belongs to: the biggest listed city within 20 km (or the nearest one when none is that close), so a
 * photo in the East Village is "New York City" and not a neighbourhood. `km` is the distance to the chosen city.
 */
export function nearestCity(lat: number, lon: number): { city: City; km: number } | null {
  let nearest = -1;
  let nearestKm = Infinity;
  const close: [number, number][] = []; // [index, km] within 20 km
  for (let i = 0; i < cities.length; i++) {
    const r = cities[i];
    if (Math.abs(r[1] - lat) > 3 && nearestKm < 330) continue; // cheap latitude gate before the trig
    const d = km(lat, lon, r[1], r[2]);
    if (d < nearestKm) {
      nearestKm = d;
      nearest = i;
    }
    if (d <= 20) close.push([i, d]);
  }
  if (nearest < 0) return null;
  if (!close.length) return { city: toCity(cities[nearest]), km: nearestKm };
  const [best, d] = close.sort((a, b) => cities[b[0]][5] - cities[a[0]][5])[0];
  return { city: toCity(cities[best]), km: d };
}

let byName: Map<string, number[]> | null = null;
const index = () => {
  if (byName) return byName;
  byName = new Map();
  cities.forEach((r, i) => {
    const k = fold(r[0]);
    (byName!.get(k) ?? byName!.set(k, []).get(k)!).push(i);
  });
  return byName;
};

/** ISO2 of a country given as a name ("United States"), ISO2 ("US") or ISO3 ("USA"); "" if unknown. */
export function countryCode(input: string | undefined): string {
  if (!input) return "";
  const f = fold(input);
  for (const [cc, name, iso3] of countries) {
    if (fold(name) === f || cc.toLowerCase() === f || iso3.toLowerCase() === f) return cc;
  }
  const alias: Record<string, string> = { usa: "US", "u s a": "US", "united states of america": "US", uk: "GB", "united kingdom": "GB", "great britain": "GB", england: "GB", korea: "KR", "south korea": "KR" };
  return alias[f] ?? "";
}

export const countryName = (cc: string) => countries.find((c) => c[0] === cc)?.[1] ?? "";

/**
 * The listed city a tag like "Cartagena de Indias" refers to: an exact name match, else the longest listed city
 * name contained in the text; within the given country when known, the biggest city wins ties.
 */
export function findCity(text: string, cc: string): City | null {
  const f = fold(text);
  if (!f) return null;
  const pick = (ids: number[] | undefined) => {
    const ok = (ids ?? []).filter((i) => !cc || countries[cities[i][3]][0] === cc);
    return ok.length ? toCity(cities[ok.sort((a, b) => cities[b][5] - cities[a][5])[0]]) : null;
  };
  const exact = pick(index().get(f));
  if (exact) return exact;
  // "Cartagena de Indias" -> "Cartagena": try the leading words, longest first
  const words = f.split(" ");
  for (let n = words.length - 1; n >= 1; n--) {
    const hit = pick(index().get(words.slice(0, n).join(" ")));
    if (hit) return hit;
  }
  return null;
}
