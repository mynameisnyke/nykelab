// Shared loader for the pages built on voyage metadata (home, places, years): the Lightroom
// catalog plus preview images from what has been uploaded. Consumers only see Voyage / Shot / PreviewImage.
//
// Each voyage is tied to the published collection that holds its photographs. Its cover, its shots' preview
// photos and its "Open voyage" link all come from that collection; a voyage without one shows no photo
// rather than somebody else's.
import { getNav, getPreviewPool } from "./collections";
import { loadCatalog } from "./catalog";
import type { HomeData } from "./voyages";

/** Catalog voyages whose collection has another name, keyed "slug" or "slug@year" (the year tells apart two trips with one slug). */
const COLLECTION_FOR: Record<string, string> = {
  barbados: "barbadoes",
  texas: "texas-2021",
  colorado: "colorado-2021",
  arizona: "sedona",
  "sesame-place": "fist-time-sesame-place-2025",
  "grand-tetons@2020": "grand-teton",
  "westminster@2020": "westminster-agility-2020",
  "westminster@2021": "westminster-2021",
  "nycc@2021": "nycc-2021-thurs-finals",
  "nycc@2022": "nycc-2022",
  "new-jersey@2025": "chiyuki-house-2025-new-jersey",
};

const DAY = 86400000;
const SLACK = 3 * DAY; // camera clocks and time zones blur the edges of a trip

export async function loadHomeData() {
  const [nav, pool] = await Promise.all([getNav(), getPreviewPool()]);
  const pickFrom = (list: number[], k: number) => (list.length ? list[k % list.length] : 0);
  const { voyages, shots } = loadCatalog(pool.images.length, (theme, k) =>
    pickFrom(theme === "city" ? (pool.city.length ? pool.city : pool.nature) : (pool.nature.length ? pool.nature : pool.city), k),
  );
  const published = new Set(nav.map((n) => n.slug));
  const overlaps = (slug: string, from: number, to: number) => {
    const c = pool.bySlug[slug];
    return !!c && c.from <= to + SLACK && c.to >= from - SLACK;
  };

  // voyage -> collection: an explicit pairing, else the collection of the same name made around the same dates
  voyages.forEach((v) => {
    const year = new Date(v.start).getUTCFullYear();
    const named = COLLECTION_FOR[`${v.slug}@${year}`] ?? COLLECTION_FOR[v.slug];
    const slug = named ?? v.slug;
    const ok = published.has(slug) && (named ? true : !pool.bySlug[slug] || overlaps(slug, v.start, v.end));
    v.collection = ok ? slug : undefined;
    v.available = ok;
    const c = ok ? pool.bySlug[slug] : undefined;
    v.cover = c ? (c.byYear[String(year)] ?? c.cover) : -1;
  });
  // a shot previews its voyage's collection photo from the year it was made
  shots.forEach((s) => {
    const c = voyages[s.v].collection ? pool.bySlug[voyages[s.v].collection!] : undefined;
    s.img = c ? (c.byYear[String(new Date(s.t).getUTCFullYear())] ?? c.byYear[""] ?? -1) : -1;
  });
  const data: HomeData = { voyages, shots, images: pool.images, sample: false };
  return { nav, pool, data };
}
