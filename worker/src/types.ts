export interface Env {
  DB: D1Database;
  MEDIA: R2Bucket;
  EVENTS: AnalyticsEngineDataset;
  ASSETS: Fetcher;
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
  size_bytes: number;
  created_at: string;
  updated_at: string;
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
  urls: { main: string; small?: string; poster?: string };
  createdAt: string;
}
