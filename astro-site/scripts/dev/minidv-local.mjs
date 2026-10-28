// Vite plugin, dev server only: serves the Mini DV captures (MINIDV_DIR, default ~/mini dv) at /minidv-local/<file>.mp4 with
// Range support, so /mini-dv can play and seek the 1 GB files straight off disk. A build never includes it; production reads
// /m/minidv/<id>.mp4 from the media bucket (src/lib/minidv.ts). Wired in astro.config.mjs.
import { createReadStream, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const minidvLocal = () => ({
  name: "minidv-local",
  apply: "serve",
  configureServer(server) {
    const dir = process.env.MINIDV_DIR ?? join(homedir(), "mini dv");
    server.middlewares.use("/minidv-local", (req, res, next) => {
      if (req.method !== "GET" && req.method !== "HEAD") return next();
      let name;
      try {
        name = decodeURIComponent((req.url ?? "").split("?")[0].replace(/^\//, ""));
      } catch {
        res.statusCode = 400;
        return res.end();
      }
      if (!name.endsWith(".mp4") || name.includes("/") || name.includes("\\") || name.includes("..")) return next();
      let size;
      try {
        size = statSync(join(dir, name)).size;
      } catch {
        res.statusCode = 404;
        return res.end();
      }
      const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
      let start = 0;
      let end = size - 1;
      if (range) {
        if (range[1] === "") {
          start = Math.max(0, size - Number(range[2])); // bytes=-N is the last N bytes
        } else {
          start = Number(range[1]);
          if (range[2] !== "") end = Math.min(Number(range[2]), size - 1);
        }
        if (start > end || start >= size) {
          res.statusCode = 416;
          res.setHeader("Content-Range", `bytes */${size}`);
          return res.end();
        }
        res.statusCode = 206;
        res.setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      }
      res.setHeader("Content-Type", "video/mp4");
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Content-Length", String(end - start + 1));
      res.setHeader("Cache-Control", "no-cache");
      if (req.method === "HEAD") return res.end();
      const stream = createReadStream(join(dir, name), { start, end });
      stream.on("error", () => res.destroy());
      res.on("close", () => stream.destroy());
      stream.pipe(res);
    });
  },
});
