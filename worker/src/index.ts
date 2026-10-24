import { Hono } from "hono";
import { adminRoutes } from "./admin";
import { eventRoutes } from "./events";
import { publicRoutes } from "./public";
import { statsRoutes } from "./stats";
import type { AppEnv } from "./types";

const app = new Hono<AppEnv>();

// Unknown /api/* paths get JSON 404s instead of the SPA's index.html.
app.route("/", publicRoutes);
app.route("/", eventRoutes);
app.route("/", adminRoutes);
app.route("/", statsRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));
app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "Internal error" }, 500);
});

export default app;
