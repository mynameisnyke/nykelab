// The Infinite Azure page: every published photograph that has an original (so sized variants exist), with the best of each
// trip marked. The page front-loads those and then shuffles the rest.
import { env } from "cloudflare:workers";
import type { Env } from "../../../worker/src/types";
import { cached } from "./cache";

/** [id, width, height, place, best (1 = one of its collection's top three)] */
export type AzureItem = [id: string, w: number, h: number, place: string, best: 0 | 1];

async function load(): Promise<AzureItem[]> {
  const { results } = await (env as unknown as Env).DB
    .prepare(
      `SELECT id, width, height, place, rn FROM (
         SELECT m.id, m.width, m.height, m.place,
                ROW_NUMBER() OVER (PARTITION BY m.collection ORDER BY m.position, m.created_at) AS rn
           FROM media m JOIN collections c ON c.slug = m.collection
          WHERE m.published = 1 AND c.published = 1 AND m.type = 'image' AND m.key_original IS NOT NULL AND m.width > 0 AND m.height > 0)`,
    )
    .all<{ id: string; width: number; height: number; place: string; rn: number }>();
  return results.map((r) => [r.id, r.width, r.height, r.place, r.rn <= 3 ? 1 : 0]);
}

export const getAzureFeed = (): Promise<AzureItem[]> => cached("azure-feed", 300, load);
