export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  /** Optional: view counting is skipped when the Analytics Engine binding is not configured. */
  EVENTS?: AnalyticsEngineDataset;
  /** Cloudflare Images binding: sized variants are generated from originals on demand. */
  IMAGES: ImagesBinding;
  ASSETS: Fetcher;
  /** KV namespace; page-data cache entries live under "cache:" (src/lib/cache.ts). */
  SESSION?: KVNamespace;
  ENVIRONMENT: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
}

export type AppEnv = {
  Bindings: Env;
  Variables: { adminEmail: string };
};

export interface MediaRow {
  id: string;
  collection: string;
  type: "image" | "video";
  caption: string;
  place: string;
  orientation: "landscape" | "portrait" | "unknown";
  width: number;
  height: number;
  position: number;
  published: number;
  featured: number;
  key_main: string;
  key_small: string | null;
  key_poster: string | null;
  /** Set for originals-first uploads; see migrations/0002_original.sql. */
  key_original: string | null;
  size_bytes: number;
  created_at: string;
  updated_at: string;
  // Read from the photo at upload (migrations/0003_photo_meta.sql). gps_lat / gps_lon are PRIVATE.
  captured_at: string | null;
  camera: string;
  lens: string;
  focal: number | null;
  aperture: number | null;
  iso: number | null;
  shutter: string;
  city: string;
  region: string;
  country: string;
  country_code: string;
  place_lat: number | null;
  place_lon: number | null;
  place_source: "tags" | "gps" | "manual" | "";
  caption_source: "photo" | "manual" | "";
  gps_lat: number | null;
  gps_lon: number | null;
  meta_read_at: string | null;
  // Graded library (migrations/0004_library.sql)
  avg_colour: string;
  text_on: string;
  look: string;
  source_id: string | null;
  duration: number | null;
}

export interface CollectionRow {
  slug: string;
  title: string;
  position: number;
  published: number;
  created_at: string;
}

// Public/admin JSON shape. `urls` are same-origin paths served from R2 via /m/*.
export interface ApiMedia {
  id: string;
  collection: string;
  type: "image" | "video";
  caption: string;
  place: string;
  orientation: "landscape" | "portrait" | "unknown";
  width: number;
  height: number;
  position: number;
  published: boolean;
  featured: boolean;
  urls: {
    main: string;
    small?: string;
    poster?: string;
    /** Originals-first images only: usable widths, smallest first (for srcset). */
    variants?: { width: number; url: string }[];
  };
  createdAt: string;
  /** Local wall-clock capture time ("2020-01-30T05:56:22"), read from the photo. */
  capturedAt: string | null;
  camera: string;
  lens: string;
  focal: number | null;
  aperture: number | null;
  iso: number | null;
  shutter: string;
  /** City-level place read from the photo. The exact GPS fix is never exposed. */
  city: string;
  region: string;
  country: string;
  countryCode: string;
  placeLat: number | null;
  placeLon: number | null;
  placeSource: "tags" | "gps" | "manual" | "";
  captionSource: "photo" | "manual" | "";
  /** The file carried a GPS fix (the fix itself stays private). */
  hasGps: boolean;
  /** Average colour as "#rrggbb": a placeholder while the file loads ("" when unknown). */
  avgColour: string;
  /** "light" or "dark": the text colour that reads best on top of this item ("" when unknown). */
  textOn: "light" | "dark" | "";
  /** Clip length in seconds (videos). */
  duration: number | null;
}
