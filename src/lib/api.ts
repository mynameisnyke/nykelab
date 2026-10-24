// Typed client for the Worker API (same origin — see worker/src).

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

export interface CollectionSummary {
  slug: string;
  title: string;
  images: number;
  videos: number;
}

export interface AdminCollection {
  slug: string;
  title: string;
  position: number;
  published: boolean;
  count: number;
}

export interface StatsResponse {
  configured: boolean;
  error?: string;
  days?: number;
  pages?: { path: string; views: number }[];
  media?: { id: string; views: number }[];
  plays?: { id: string; plays: number; completes: number }[];
  daily?: { day: string; views: number }[];
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = res.statusText;
    try {
      message = (await res.json()).error ?? message;
    } catch {
      // non-JSON error body
    }
    throw new ApiError(res.status, message);
  }
  return res.json() as Promise<T>;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

// ---- public ---------------------------------------------------------------

export const getCollections = () =>
  request<{ collections: CollectionSummary[]; featuredCount: number }>("/api/collections");

export const getCollectionMedia = (slug: string) =>
  request<{ media: ApiMedia[] }>(`/api/media?collection=${encodeURIComponent(slug)}`).then(
    (r) => r.media,
  );

export const getFeaturedMedia = () =>
  request<{ media: ApiMedia[] }>("/api/media?featured=1").then((r) => r.media);

// ---- admin ----------------------------------------------------------------

export const admin = {
  me: () => request<{ email: string }>("/api/admin/me"),
  collections: () =>
    request<{ collections: AdminCollection[] }>("/api/admin/collections").then(
      (r) => r.collections,
    ),
  createCollection: (title: string) =>
    request<{ slug: string }>("/api/admin/collections", json("POST", { title })),
  updateCollection: (slug: string, patch: { title?: string; published?: boolean }) =>
    request<{ ok: true }>(`/api/admin/collections/${slug}`, json("PATCH", patch)),
  deleteCollection: (slug: string) =>
    request<{ ok: true }>(`/api/admin/collections/${slug}`, { method: "DELETE" }),
  orderCollections: (slugs: string[]) =>
    request<{ ok: true }>("/api/admin/collection-order", json("PUT", { slugs })),

  media: (collection?: string) =>
    request<{ media: ApiMedia[] }>(
      `/api/admin/media${collection ? `?collection=${encodeURIComponent(collection)}` : ""}`,
    ).then((r) => r.media),
  createMedia: (body: Record<string, unknown>) =>
    request<{ media: ApiMedia }>("/api/admin/media", json("POST", body)).then((r) => r.media),
  updateMedia: (
    id: string,
    patch: Partial<
      Pick<ApiMedia, "caption" | "place" | "collection" | "orientation" | "published" | "featured">
    >,
  ) => request<{ media: ApiMedia }>(`/api/admin/media/${id}`, json("PATCH", patch)).then((r) => r.media),
  deleteMedia: (id: string) =>
    request<{ ok: true }>(`/api/admin/media/${id}`, { method: "DELETE" }),
  orderMedia: (collection: string, ids: string[]) =>
    request<{ ok: true }>("/api/admin/media-order", json("PUT", { collection, ids })),

  stats: (days: number) => request<StatsResponse>(`/api/admin/stats?days=${days}`),

  // XHR (not fetch) so the browser reports upload progress.
  upload(
    id: string,
    role: "main" | "small" | "poster",
    blob: Blob,
    onProgress?: (fraction: number) => void,
  ): Promise<{ key: string; size: number }> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", `/api/admin/upload/${id}/${role}`);
      xhr.setRequestHeader("Content-Type", blob.type);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(e.loaded / e.total);
      };
      xhr.onload = () => {
        let body: { key?: string; size?: number; error?: string } = {};
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          // non-JSON
        }
        if (xhr.status >= 200 && xhr.status < 300 && body.key) {
          resolve({ key: body.key, size: body.size ?? blob.size });
        } else {
          reject(new ApiError(xhr.status, body.error ?? `Upload failed (${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new ApiError(0, "Network error during upload"));
      xhr.send(blob);
    });
  },
};
