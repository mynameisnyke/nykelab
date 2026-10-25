// Shared loader for the pages built on voyage metadata (home, places, years): the Lightroom
// catalog plus preview images from what has been uploaded. Consumers only see Voyage / Shot / PreviewImage.
import { getNav, getPreviewPool } from "./collections";
import { loadCatalog } from "./catalog";
import type { HomeData } from "./voyages";

/** Catalog voyages whose published collection has a different slug (preview image only; the links are unchanged). */
const COVER_ALIAS: Record<string, string> = {
  barbados: "barbadoes",
  texas: "texas-2021",
  colorado: "colorado-2021",
  "sesame-place": "fist-time-sesame-place-2025",
};

export async function loadHomeData() {
  const [nav, pool] = await Promise.all([getNav(), getPreviewPool()]);
  const pickFrom = (list: number[], k: number) => (list.length ? list[k % list.length] : 0);
  const { voyages, shots } = loadCatalog(pool.images.length, (theme, k) =>
    pickFrom(theme === "city" ? (pool.city.length ? pool.city : pool.nature) : (pool.nature.length ? pool.nature : pool.city), k),
  );
  const slugs = new Set(nav.map((n) => n.slug));
  voyages.forEach((v) => {
    v.available = slugs.has(v.slug);
    // A voyage with its own published collection previews its own photo; others borrow one.
    const own = pool.bySlug[COVER_ALIAS[v.slug] ?? v.slug];
    if (own !== undefined) v.cover = own;
  });
  shots.forEach((s) => {
    const own = pool.bySlug[COVER_ALIAS[voyages[s.v].slug] ?? voyages[s.v].slug];
    if (own !== undefined) s.img = own;
  });
  const data: HomeData = { voyages, shots, images: pool.images, sample: false };
  return { nav, pool, data };
}
