#!/usr/bin/env node
// Applies data/gallery-curation.json to the database without republishing the library: hides the listed near-duplicate photos
// (media.published = 0, rows and files stay) and moves a gallery's chosen cover to the front. Fully reversible.
//
//   node scripts/curate-galleries.mjs --target remote                  apply the file (idempotent)
//   node scripts/curate-galleries.mjs --target remote --restore all    bring everything back (photos shown again, covers back where they were)
//   node scripts/curate-galleries.mjs --target remote --restore nycc-2022,3537ea53ef00   a whole gallery and/or single photos (media ids)
//   add --dry-run to print the SQL instead of running it
//
// A restore also deletes those entries from the file, so a later publisher run does not hide them again (git has the old list).
// publish-library.mjs reads the same file, so a full republish keeps these photos hidden.
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

const { values: a } = parseArgs({
  options: {
    target: { type: "string", default: "local" },
    restore: { type: "string" },
    "dry-run": { type: "boolean", default: false },
  },
});
const file = new URL("../data/gallery-curation.json", import.meta.url);
const cur = JSON.parse(fs.readFileSync(file, "utf8"));
const where = a.target === "remote" ? ["--remote"] : ["--local", "--persist-to", ".wrangler/state"];
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

function run(sql) {
  if (a["dry-run"]) return console.log(sql);
  const tmp = path.join(os.tmpdir(), "curate-galleries.sql");
  fs.writeFileSync(tmp, sql);
  return new Promise((resolve, reject) => {
    const p = spawn("npx", ["wrangler", "d1", "execute", "DB", ...where, "--file", tmp], { stdio: ["ignore", "inherit", "inherit"] });
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`wrangler failed (${code})`))));
  }).finally(() => fs.rmSync(tmp, { force: true }));
}

const sql = [];
if (a.restore) {
  const keys = new Set(a.restore.split(","));
  const all = keys.has("all");
  const back = cur.hidden.filter((h) => all || keys.has(h.id) || keys.has(h.gallery));
  const covers = Object.entries(cur.covers ?? {}).filter(([g, c]) => all || keys.has(g) || keys.has(c.id));
  for (const h of back) sql.push(`UPDATE media SET published = 1 WHERE id = ${q(h.id)} AND source_id IS NOT NULL;`);
  for (const [, c] of covers) sql.push(`UPDATE media SET position = ${c.was} WHERE id = ${q(c.id)};`);
  cur.hidden = cur.hidden.filter((h) => !back.includes(h));
  for (const [g] of covers) delete cur.covers[g];
  console.log(`restoring ${back.length} photos and ${covers.length} covers`);
} else {
  for (const h of cur.hidden) sql.push(`UPDATE media SET published = 0 WHERE id = ${q(h.id)} AND source_id IS NOT NULL;`);
  for (const [g, c] of Object.entries(cur.covers ?? {}))
    // only when it is not already first, so a rerun does not keep moving it
    sql.push(`UPDATE media SET position = (SELECT MIN(position) - 1 FROM media WHERE collection = ${q(g)}) WHERE id = ${q(c.id)}
  AND position > (SELECT MIN(position) FROM media WHERE collection = ${q(g)} AND id != ${q(c.id)});`);
  console.log(`hiding ${cur.hidden.length} photos, ${Object.keys(cur.covers ?? {}).length} cover(s)`);
}
await run(sql.join("\n"));
if (a.restore && !a["dry-run"]) {
  const rows = cur.hidden.map((h) => `  ${JSON.stringify(h)}`).join(",\n");
  fs.writeFileSync(file, `{\n "note": ${JSON.stringify(cur.note)},\n "covers": ${JSON.stringify(cur.covers)},\n "hidden": [\n${rows}\n ]\n}\n`);
}
