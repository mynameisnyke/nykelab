import { getCollection, type CollectionEntry } from "astro:content";

export type Post = CollectionEntry<"journal">;

/** Published posts, newest first. Drafts are visible in dev only. */
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection("journal", ({ data }) => import.meta.env.DEV || !data.draft);
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function readingMinutes(body: string | undefined): number {
  const words = (body ?? "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric", timeZone: "UTC" });
}

/** Category = a post's first tag; drives the filter pills. */
export function categories(posts: Post[]): string[] {
  const counts = new Map<string, number>();
  for (const p of posts) {
    const c = p.data.tags[0];
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

/** Every tag used by any post (a post's page links all of its tags, so each needs a page; the filter pills show only categories). */
export function allTags(posts: Post[]): string[] {
  return [...new Set(posts.flatMap((p) => p.data.tags))].sort((a, b) => a.localeCompare(b));
}

export function slugifyTag(tag: string): string {
  return tag.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
