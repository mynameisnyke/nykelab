// Shared loader for the pages built on voyage metadata (home, places, years): the Lightroom
// catalog plus preview images from what has been uploaded. Consumers only see Voyage / Shot / PreviewImage.
import { getNav, getPreviewPool } from "./collections";
import { loadCatalog } from "./catalog";
import type { HomeData } from "./voyages";

export async function loadHomeData() {
  const [nav, pool] = await Promise.all([getNav(), getPreviewPool()]);
  const pickFrom = (list: number[], k: number) => (list.length ? list[k % list.length] : 0);
  const { voyages, shots } = loadCatalog(pool.images.length, (theme, k) =>
    pickFrom(theme === "city" ? (pool.city.length ? pool.city : pool.nature) : (pool.nature.length ? pool.nature : pool.city), k),
  );
  const slugs = new Set(nav.map((n) => n.slug));
  voyages.forEach((v) => (v.available = slugs.has(v.slug)));
  const data: HomeData = { voyages, shots, images: pool.images, sample: false };
  return { nav, pool, data };
}
