// Place, Year and Event pages: each voyage shows photographs from the collection that really holds it,
// and the page's hero is a clip from one of those collections when there is one.
import { getGalleryPhotos, getHeroVideos, type Photo } from "./collections";
import picks from "../data/page-picks.json";
import { fmtDate, type Voyage } from "./voyages";

const yearOf = (p: Photo) => Number((p.capturedAt ?? "").slice(0, 4)) || 0;

/** Up to `n` photographs in rank order, portraits first (the tiles are portrait); a row of 3 reads best, so 4-5 become 3. */
export function pickGallery(pool: Photo[]): Photo[] {
  const n = pool.length >= 6 ? 6 : pool.length >= 3 ? 3 : pool.length;
  const take = new Set<Photo>();
  for (const portrait of [true, false]) for (const p of pool) if (take.size < n && (p.orientation === "portrait") === portrait) take.add(p);
  return pool.filter((p) => take.has(p));
}

/** "Jan 5, 2020" from the photo's capture time ("" when it has none). */
export function photoDate(p: Photo): string {
  const t = Date.parse(`${p.capturedAt ?? ""}Z`);
  return Number.isNaN(t) ? "" : fmtDate(t);
}

export interface Gallery {
  voyage: Voyage;
  photos: Photo[];
}

/** `order` indexes `voyages`; `year` limits each voyage to photographs made that year. */
export async function loadGalleries(voyages: Voyage[], order: number[], year?: number, pinHero = false) {
  const slugsOf = (v: Voyage) => v.collections ?? (v.collection ? [v.collection] : []);
  const slugs = [...new Set(order.flatMap((i) => slugsOf(voyages[i])))];
  const [photos, videos] = await Promise.all([getGalleryPhotos(slugs, 100), getHeroVideos(slugs)]);
  // a trip spread over several collections shows them in turn: best of each, then second best of each, ...
  const DAY = 86400000;
  const madeDuring = (v: Voyage, p: Photo) => {
    const t = Date.parse(`${p.capturedAt ?? ""}Z`);
    return Number.isNaN(t) || (t >= v.start - 3 * DAY && t <= v.end + 4 * DAY);
  };
  const merged = (v: Voyage) => {
    const lists = slugsOf(v).map((c) => (photos.get(c) ?? []).filter((p) => madeDuring(v, p) && (!year || !yearOf(p) || yearOf(p) === year)));
    return Array.from({ length: Math.max(0, ...lists.map((l) => l.length)) }, (_, k) => lists.flatMap((l) => (l[k] ? [l[k]] : []))).flat();
  };
  const groups: Gallery[] = order.map((i) => ({ voyage: voyages[i], photos: pickGallery(merged(voyages[i])) }));
  // hero clip: from the biggest voyage that has one (on a Year page, one with photographs from that year)
  const heroVideo = [...groups]
    .sort((a, b) => b.voyage.count - a.voyage.count)
    .filter((g) => !year || g.photos.length || new Date(g.voyage.start).getUTCFullYear() === year)
    .flatMap((g) => slugsOf(g.voyage).flatMap((c) => (videos.has(c) ? [videos.get(c)!] : [])))[0];
  // hero still, when there is no clip: the best-ranked landscape from the biggest voyage that has one sharp enough to fill the screen
  const heroPhoto = [...order]
    .sort((a, b) => voyages[b].count - voyages[a].count)
    .flatMap((i) => merged(voyages[i]).filter((p) => p.type === "image" && p.orientation !== "portrait" && p.heroOk).slice(0, 1))[0];
  // a hand-picked hero (data/page-picks.json) for a place wins over everything automatic
  const pinned = pinHero
    ? [...order]
        .sort((x, y) => voyages[y].count - voyages[x].count)
        .flatMap((i) => slugsOf(voyages[i]).flatMap((c) => (photos.get(c) ?? []).filter((p) => p.id === (picks as Record<string, { hero?: string }>)[c]?.hero)))[0]
    : undefined;
  return pinned ? { groups, heroVideo: undefined, heroPhoto: pinned } : { groups, heroVideo, heroPhoto };
}
