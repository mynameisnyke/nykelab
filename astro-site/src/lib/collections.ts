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
