// The only place the photo pages touch data. Today it reads D1 directly; if the
// source changes (KV snapshot, another API) only this file needs to change.
import { env } from "cloudflare:workers";
import type { ApiMedia, Env, MediaRow } from "../../../worker/src/types";
import { RESERVED_SLUGS, SLUG_RE, toApiMedia } from "../../../worker/src/util";

const db = () => (env as unknown as Env).DB;

export interface NavItem {
  slug: string;
  title: string;
}
export interface Photo extends ApiMedia {
  /** Pixel widths of the stored `small` / `main` variants (for srcset). */
  smallWidth: number;
  mainWidth: number;
}
export interface CollectionPage {
  slug: string;
  title: string;
  media: Photo[];
  images: number;
  videos: number;
  /** Next collection in nav order, with a cover image for the "next chapter" block. */
  next?: NavItem & { cover?: Photo };
}

const MAIN_EDGE = 2400; // keep in sync with src/lib/imageVariants.ts
const SMALL_EDGE = 900;

function withWidths(m: ApiMedia): Photo {
  const long = Math.max(m.width, m.height) || 1;
  const w = m.width || 1;
  return {
    ...m,
    smallWidth: Math.round(w * Math.min(1, SMALL_EDGE / long)),
    mainWidth: Math.round(w * Math.min(1, MAIN_EDGE / long)),
  };
}

export const isCollectionSlug = (s: string) => SLUG_RE.test(s) && !RESERVED_SLUGS.has(s);

/** Published collections that have at least one published item, in nav order. */
export async function getNav(): Promise<NavItem[]> {
  const { results } = await db()
    .prepare(
      `SELECT c.slug, c.title
         FROM collections c JOIN media m ON m.collection = c.slug AND m.published = 1
        WHERE c.published = 1
        GROUP BY c.slug
        ORDER BY c.position, c.title`,
    )
    .all<NavItem>();
  return results;
}

async function mediaFor(slug: string, limit = 500): Promise<MediaRow[]> {
  const { results } = await db()
    .prepare(
      `SELECT m.* FROM media m JOIN collections c ON c.slug = m.collection
        WHERE m.published = 1 AND c.published = 1 AND m.collection = ?
        ORDER BY m.position, m.created_at LIMIT ?`,
    )
    .bind(slug, limit)
    .all<MediaRow>();
  return results;
}

export async function getCollectionPage(slug: string): Promise<CollectionPage | null> {
  if (!isCollectionSlug(slug)) return null;
  const nav = await getNav();
  const idx = nav.findIndex((n) => n.slug === slug);
  if (idx < 0) return null;

  const media = (await mediaFor(slug)).map(toApiMedia).map(withWidths);
  const nextItem = nav[(idx + 1) % nav.length];
  let next: CollectionPage["next"];
  if (nextItem && nextItem.slug !== slug) {
    const cover = (await mediaFor(nextItem.slug, 1)).map(toApiMedia).map(withWidths)[0];
    next = { ...nextItem, cover };
  }
  return {
    slug,
    title: nav[idx].title,
    media,
    images: media.filter((m) => m.type === "image").length,
    videos: media.filter((m) => m.type === "video").length,
    next,
  };
}

// ---- Home visualization ---------------------------------------------------------

export interface PreviewPool {
  images: import("./voyages").PreviewImage[];
  /** Indices into `images`, grouped by subject, so sample voyages get fitting covers. */
  nature: number[];
  city: number[];
  /** Collection slug -> its cover and its first photo of each year (indices into `images`; "" = undated), plus the dates it spans. */
  bySlug: Record<string, { cover: number; byYear: Record<string, number>; from: number; to: number }>;
}

/** One photo per published collection per year (its first that year), used as hover previews and year strips. */
export async function getPreviewPool(): Promise<PreviewPool> {
  const { results } = await db()
    .prepare(
      `SELECT * FROM (
         SELECT m.*, c.position AS cpos,
                ROW_NUMBER() OVER (PARTITION BY m.collection ORDER BY m.position, m.created_at) AS col_rn,
                ROW_NUMBER() OVER (PARTITION BY m.collection, SUBSTR(COALESCE(m.captured_at, ''), 1, 4) ORDER BY m.position, m.created_at) AS year_rn,
                (SELECT MIN(m3.captured_at) FROM media m3 WHERE m3.collection = c.slug AND m3.captured_at IS NOT NULL) AS first_at,
                (SELECT MAX(m3.captured_at) FROM media m3 WHERE m3.collection = c.slug AND m3.captured_at IS NOT NULL) AS last_at
           FROM media m JOIN collections c ON c.slug = m.collection
          WHERE m.published = 1 AND c.published = 1 AND m.type = 'image')
        WHERE year_rn = 1
        ORDER BY cpos, position, created_at`,
    )
    .all<MediaRow & { col_rn: number; first_at: string | null; last_at: string | null }>();
  const pool: PreviewPool = { images: [], nature: [], city: [], bySlug: {} };
  for (const row of results) {
    const m = withWidths(toApiMedia(row));
    const srcset = m.urls.variants
      ? m.urls.variants.map((v) => `${v.url} ${v.width}w`).join(", ")
      : m.urls.small
        ? `${m.urls.small} ${m.smallWidth}w, ${m.urls.main} ${m.mainWidth}w`
        : undefined;
    const year = (row.captured_at ?? "").slice(0, 4);
    const i = pool.images.push({
      src: m.urls.small ?? m.urls.main,
      srcset,
      w: m.width,
      h: m.height,
      alt: m.place || m.caption.split("\n")[0] || "",
      year: Number(year) || undefined,
    }) - 1;
    const from = Date.parse(`${row.first_at ?? ""}Z`);
    const to = Date.parse(`${row.last_at ?? ""}Z`);
    const c = (pool.bySlug[m.collection] ??= {
      cover: i,
      byYear: {},
      from: Number.isNaN(from) ? -Infinity : from,
      to: Number.isNaN(to) ? Infinity : to,
    });
    c.byYear[year] = i; // "" holds photographs without a capture date
    if (row.col_rn === 1) c.cover = i;
    (/westminster|new-york|city/.test(m.collection) ? pool.city : pool.nature).push(i);
  }
  return pool;
}
