// Shared loader for the pages built on voyage metadata (home, places, years): the Lightroom
// catalog plus preview images from what has been uploaded. Consumers only see Voyage / Shot / PreviewImage.
//
// Each voyage is tied to the published collection that holds its photographs. Its cover, its shots' preview
// photos and its "Open voyage" link all come from that collection; a voyage without one shows no photo
// rather than somebody else's.
import { getNav, getPreviewPool } from "./collections";
import { loadCatalog } from "./catalog";
import type { HomeData } from "./voyages";

export async function loadHomeData() {
  const [nav, pool] = await Promise.all([getNav(), getPreviewPool()]);
  const pickFrom = (list: number[], k: number) => (list.length ? list[k % list.length] : 0);
  const { voyages, shots } = loadCatalog(pool.images.length, (theme, k) =>
    pickFrom(theme === "city" ? (pool.city.length ? pool.city : pool.nature) : (pool.nature.length ? pool.nature : pool.city), k),
  );
  const published = new Set(nav.map((n) => n.slug));
  const slugCount = new Map<string, number>();
  for (const v of voyages) slugCount.set(v.slug, (slugCount.get(v.slug) ?? 0) + 1);

  // voyage -> its collection: the page named for the trip. Bogotá also has your own upload collection (bogota) beside the graded one.
  voyages.forEach((v) => {
    const year = new Date(v.start).getUTCFullYear();
    // one page per voyage: its catalogue slug, or its id where two voyages share a slug (Wyoming, Westminster, Comic Con): same ids as publish-library.mjs
    const slug = (slugCount.get(v.slug) ?? 0) > 1 ? v.id : v.slug;
    const all = (slug === "bogota" ? ["bogota", "bogota-library"] : [slug]).filter((c) => published.has(c));
    const ok = all.length > 0;
    v.collection = ok ? all[0] : undefined;
    v.collections = ok ? all : undefined;
    v.available = ok;
    const c = ok ? pool.bySlug[all[0]] : undefined;
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
