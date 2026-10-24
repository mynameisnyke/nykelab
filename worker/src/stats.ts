import { Hono } from "hono";
import { requireAdmin } from "./auth";
import type { AppEnv } from "./types";

export const statsRoutes = new Hono<AppEnv>();

const DATASET = "nykelab_events";

async function sql<T>(accountId: string, token: string, query: string): Promise<T[]> {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/analytics_engine/sql`,
    { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: query },
  );
  if (!res.ok) throw new Error(`Analytics SQL ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { data: T[] };
  return json.data;
}

statsRoutes.use("/api/admin/*", requireAdmin);

statsRoutes.get("/api/admin/stats", async (c) => {
  const { CF_ACCOUNT_ID, CF_API_TOKEN } = c.env;
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) {
    return c.json({ configured: false });
  }

  // days is interpolated into SQL, so it must be a plain bounded integer.
  const days = Math.min(Math.max(Math.trunc(Number(c.req.query("days"))) || 7, 1), 90);
  const since = `timestamp > NOW() - INTERVAL '${days}' DAY`;
  const run = <T>(q: string) => sql<T>(CF_ACCOUNT_ID, CF_API_TOKEN, q);

  try {
    const [pages, media, plays, daily] = await Promise.all([
      run<{ path: string; views: number }>(
        `SELECT blob4 AS path, SUM(_sample_interval) AS views FROM ${DATASET}
          WHERE blob1 = 'page_view' AND ${since} GROUP BY path ORDER BY views DESC LIMIT 25`,
      ),
      run<{ id: string; views: number }>(
        `SELECT blob2 AS id, SUM(_sample_interval) AS views FROM ${DATASET}
          WHERE blob1 = 'media_view' AND ${since} GROUP BY id ORDER BY views DESC LIMIT 50`,
      ),
      run<{ id: string; plays: number; completes: number }>(
        `SELECT blob2 AS id,
                SUM(IF(blob1 = 'video_play', _sample_interval, 0)) AS plays,
                SUM(IF(blob1 = 'video_progress' AND double1 >= 100, _sample_interval, 0)) AS completes
           FROM ${DATASET}
          WHERE blob1 IN ('video_play', 'video_progress') AND ${since}
          GROUP BY id ORDER BY plays DESC LIMIT 50`,
      ),
      run<{ day: string; views: number }>(
        `SELECT toStartOfInterval(timestamp, INTERVAL '1' DAY) AS day, SUM(_sample_interval) AS views
           FROM ${DATASET} WHERE blob1 = 'page_view' AND ${since} GROUP BY day ORDER BY day`,
      ),
    ]);
    return c.json({ configured: true, days, pages, media, plays, daily });
  } catch (err) {
    return c.json({ configured: true, error: String(err) }, 502);
  }
});
