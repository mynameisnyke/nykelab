// Short-lived cache for the data every page needs (menu, home previews) so D1 is not re-scanned on each request.
// Only in production: locally (and in tests) edits show immediately. Entries expire on their own; KV's minimum is 60 s.
import { env } from "cloudflare:workers";
import type { Env } from "../../../worker/src/types";

export async function cached<T>(key: string, ttlSeconds: number, load: () => Promise<T>): Promise<T> {
  const e = env as unknown as Env;
  if (e.ENVIRONMENT !== "production" || !e.SESSION) return load();
  try {
    const hit = await e.SESSION.get<T>(`cache:${key}`, "json");
    if (hit !== null) return hit;
  } catch {
    // a failed read just means a fresh load
  }
  const value = await load();
  try {
    await e.SESSION.put(`cache:${key}`, JSON.stringify(value), { expirationTtl: Math.max(60, ttlSeconds) });
  } catch {
    // KV write limits must never break a page
  }
  return value;
}
