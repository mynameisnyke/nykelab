// Shared loader for pages built on the sample voyage metadata (home, places, years).
// Replace with real rows (EXIF → D1) later; consumers only see Voyage / Shot / PreviewImage.
import { getNav, getPreviewPool } from "./collections";
import { buildSample, type HomeData } from "./voyages";

export async function loadSample() {
  const [nav, pool] = await Promise.all([getNav(), getPreviewPool()]);
  const pickFrom = (list: number[], k: number) => (list.length ? list[k % list.length] : 0);
  const { voyages, shots } = buildSample(pool.images.length, (theme, k) =>
    pickFrom(theme === "city" ? (pool.city.length ? pool.city : pool.nature) : (pool.nature.length ? pool.nature : pool.city), k),
  );
  const slugs = new Set(nav.map((n) => n.slug));
  voyages.forEach((v) => (v.available = slugs.has(v.slug)));
  const data: HomeData = { voyages, shots, images: pool.images, sample: true };
  return { nav, pool, data };
}
