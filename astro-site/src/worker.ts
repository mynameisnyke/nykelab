// Worker entry. Order matters: static assets → existing Hono API → Astro pages.
// The API modules are shared with the Vue app's Worker (../worker/src) unchanged.
import { Hono, type MiddlewareHandler } from "hono";
import { cf } from "@astrojs/cloudflare/hono";
import { middleware, pages } from "astro/hono";
import { publicRoutes } from "../../worker/src/public";
import { eventRoutes } from "../../worker/src/events";
import { adminRoutes } from "../../worker/src/admin";
import { statsRoutes } from "../../worker/src/stats";
import type { AppEnv } from "../../worker/src/types";

const app = new Hono<AppEnv>();

// `wrangler types` narrows ENVIRONMENT to a literal; the shared Env type uses string.
const asMiddleware = (fn: unknown) => fn as MiddlewareHandler<AppEnv>;

app.use(asMiddleware(cf()));

app.route("/", publicRoutes);
app.route("/", eventRoutes);
app.route("/", adminRoutes);
app.route("/", statsRoutes);

// Unknown /api/* paths get JSON 404s instead of an HTML page.
app.all("/api/*", (c) => c.json({ error: "Not found" }, 404));

// Short edge cache for server-rendered pages that opt in with `s-maxage`.
// Edits made in /admin appear within that window; skipped in local dev.
app.use(async (c, next) => {
  if (c.req.method !== "GET" || c.env.ENVIRONMENT === "development") return next();
  const cache = (caches as unknown as { default: Cache }).default;
  const hit = await cache.match(c.req.raw);
  if (hit) return hit;
  await next();
  if (c.res.status === 200 && /s-maxage/.test(c.res.headers.get("Cache-Control") ?? "")) {
    c.executionCtx.waitUntil(cache.put(c.req.raw, c.res.clone()));
  }
});

app.use(asMiddleware(middleware()));
app.use(asMiddleware(pages()));

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal error" }, 500);
});

export default app;
