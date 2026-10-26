// Loads the Lightroom-derived catalog (src/data/catalog.json, built by `npm run catalog`) into the
// Voyage / Shot shapes. Photographs are not uploaded yet, so each voyage and shot borrows a preview
// image from the pool of uploaded photos (matching its theme) until real ones exist.
import raw from "../data/catalog.json";
import type { Shot, Theme, Voyage, VoyageKind } from "./voyages";

interface CatalogVoyage {
  id: string;
  slug: string;
  title: string;
  kind: VoyageKind;
  series?: string;
  hidden?: boolean;
  placeSlug: string;
  placeName: string;
  place: string;
  country: string;
  lat: number;
  lon: number;
  theme: Theme;
  color: string;
  start: number;
  end: number;
  count: number;
}

const catalog = raw as unknown as {
  series: Record<string, { name: string; about: string }>;
  voyages: CatalogVoyage[];
  lenses: string[];
  shots: [number, number, number, number, number, number, number, string, number][];
};

export const lenses = catalog.lenses;
/** Recurring events (Westminster, NYCC): display name and one-line description, keyed by series slug. */
export const seriesInfo = catalog.series;

export function loadCatalog(imageCount: number, coverFor: (theme: Theme, i: number) => number): { voyages: Voyage[]; shots: Shot[] } {
  // A hidden voyage stays in the catalogue file but is left off the site entirely; the rest keep their order and shots are re-pointed.
  const at = new Map<number, number>();
  catalog.voyages.forEach((v, i) => !v.hidden && at.set(i, at.size));
  const voyages = catalog.voyages.flatMap((v, vi): Voyage[] => v.hidden ? [] : [{
      id: v.id,
      slug: v.slug,
      title: v.title,
      kind: v.kind,
      series: v.series,
      placeSlug: v.placeSlug,
      placeName: v.placeName,
      place: v.place,
      country: v.country,
      lat: v.lat,
      lon: v.lon,
      color: v.color,
      start: v.start,
      end: v.end,
      count: v.count,
      available: false,
      cover: coverFor(v.theme, vi),
    }]);
  const shots = catalog.shots.flatMap((r, i): Shot[] => !at.has(r[0]) ? [] : [{
      id: String(i),
      v: at.get(r[0])!,
      t: r[1] * 60000,
      hour: r[2] / 100,
      clock: r[3] / 100,
      lat: voyages[at.get(r[0])!].lat,
      lon: voyages[at.get(r[0])!].lon,
      focal: r[4],
      f: r[5],
      iso: r[6],
      shutter: r[7],
      lens: catalog.lenses[r[8]] ?? "",
      img: coverFor(catalog.voyages[r[0]].theme, r[0] * 100000 + i) % Math.max(1, imageCount),
    }]);
  return { voyages, shots };
}
