import type { ApiMedia, MediaRow } from "./types";

export const ID_RE = /^[a-f0-9]{12}$/;
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

// Slugs that would collide with fixed site routes.
export const RESERVED_SLUGS = new Set(["admin", "api", "m", "world", "about", "c", "assets"]);

export const mediaUrl = (key: string) => `/m/${key}`;

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
    urls: {
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
