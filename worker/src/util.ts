import type { ApiMedia, MediaRow } from "./types";

export const ID_RE = /^[a-f0-9]{12}$/;
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

// Slugs that would collide with fixed site routes.
export const RESERVED_SLUGS = new Set(["admin", "api", "m", "world", "about", "c", "assets"]);

export const mediaUrl = (key: string) => `/m/${key}`;

// Allowed variant widths (px). A fixed list keeps the transform endpoint from being
// used to generate arbitrary sizes. Variants never upscale past the original.
export const VARIANT_WIDTHS = [480, 900, 1440, 2400] as const;
export const variantUrl = (id: string, w: number) => `/m/${id}/w${w}.webp`;

/** Variants worth offering for an original of `width` px (0 = unknown → all). */
function variantsFor(id: string, width: number) {
  const out: { width: number; url: string }[] = [];
  for (const w of VARIANT_WIDTHS) {
    out.push({ width: width > 0 ? Math.min(w, width) : w, url: variantUrl(id, w) });
    if (width > 0 && w >= width) break; // this one already serves the full original
  }
  return out;
}

export function toApiMedia(row: MediaRow): ApiMedia {
  return {
    id: row.id,
    collection: row.collection,
    type: row.type,
    caption: row.caption,
    place: row.place,
    orientation: row.orientation,
    width: row.width,
    height: row.height,
    position: row.position,
    published: !!row.published,
    featured: !!row.featured,
    urls: row.key_original
      ? (() => {
          const variants = variantsFor(row.id, row.width);
          return {
            main: variants[variants.length - 1].url,
            small: variantUrl(row.id, 900),
            variants,
          };
        })()
      : {
          main: mediaUrl(row.key_main),
          ...(row.key_small ? { small: mediaUrl(row.key_small) } : {}),
          ...(row.key_poster ? { poster: mediaUrl(row.key_poster) } : {}),
        },
    createdAt: row.created_at,
  };
}

export const isString = (v: unknown, max: number): v is string =>
  typeof v === "string" && v.length <= max;

export const intOr = (v: unknown, fallback: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.trunc(v) : fallback;
