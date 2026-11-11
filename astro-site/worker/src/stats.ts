import { Hono } from "hono";
import { requireAdmin } from "./auth";
import { postPath } from "./events";
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

// All-time counts per journal post, and for the site, from the D1 counters (exact, and needs no API token; see events.ts).
// `visitors` is the sum of each day's unique visitors, counted since migration 0008.
statsRoutes.get("/api/admin/post-views", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT name, n FROM counters").all<{ name: string; n: number }>();
  const n = (name: string) => results.find((r) => r.name === name)?.n ?? 0;
  const posts = results
    .filter((r) => r.name.startsWith("views:"))
    .map((r) => ({ path: r.name.slice(6), views: r.n, visitors: n(`visitors:${r.name.slice(6)}`) }))
    .sort((a, b) => b.views - a.views);
  return c.json({ site: { views: n("views"), visitors: n("visitors") }, posts });
});

// Page views from before the per-post counters existed are only in Analytics Engine (about three months back). This raises
// each post's counter to what Analytics Engine has for it; it never lowers one, so it is safe to run more than once.
statsRoutes.post("/api/admin/post-views/backfill", async (c) => {
  const { CF_ACCOUNT_ID, CF_API_TOKEN } = c.env;
  if (!CF_ACCOUNT_ID || !CF_API_TOKEN) return c.json({ configured: false });
  try {
    const rows = await sql<{ path: string; views: number | string }>(
      CF_ACCOUNT_ID,
      CF_API_TOKEN,
      `SELECT blob4 AS path, SUM(_sample_interval) AS views FROM ${DATASET}
        WHERE blob1 = 'page_view' GROUP BY path ORDER BY views DESC LIMIT 5000`,
    );
    const totals = new Map<string, number>(); // "/journal/x" and "/journal/x/" are the same post
    for (const r of rows) {
      const post = postPath(r.path);
      if (post) totals.set(post, (totals.get(post) ?? 0) + Math.round(Number(r.views) || 0));
    }
    const posts = [...totals].map(([path, views]) => ({ path, views }));
    if (posts.length) {
      await c.env.DB.batch(
        posts.map((p) =>
          c.env.DB.prepare(
            "INSERT INTO counters (name, n) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET n = MAX(n, excluded.n)",
          ).bind(`views:${p.path}`, p.views),
        ),
      );
    }
    return c.json({ configured: true, posts });
  } catch (err) {
    return c.json({ configured: true, error: String(err) }, 502);
  }
});

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
