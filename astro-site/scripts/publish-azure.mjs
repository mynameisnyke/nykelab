#!/usr/bin/env node
// Puts the Infinite Azure page's own media into storage under azure/: the looping background, its poster frame, and the music.
// Read-only on the sources. Rerun to replace them (same keys).
//
//   node scripts/publish-azure.mjs                  local storage (what `npm run dev` serves)
//   node scripts/publish-azure.mjs --target remote  the live bucket
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { parseArgs } from "node:util";

const { values: a } = parseArgs({
  options: {
    target: { type: "string", default: "local" },
    video: { type: "string", default: "/Volumes/Whiskey/resolve/LibraryGrade/infinite-azure/C0001_infinite-azure_20s.mp4" },
    music: { type: "string", default: path.join(os.homedir(), "Downloads", "if azure.mp3") },
    bucket: { type: "string", default: "nykelab-media" },
  },
});
const where = a.target === "remote" ? ["--remote"] : ["--local", "--persist-to", ".wrangler/state"];

const poster = path.join(os.tmpdir(), "azure-background.jpg");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", "3", "-i", a.video, "-frames:v", "1", "-vf", "scale=1920:-2", "-q:v", "4", poster]);

for (const [key, file, type] of [
  ["azure/background.mp4", a.video, "video/mp4"],
  ["azure/background.jpg", poster, "image/jpeg"],
  ["azure/infinite-azure.mp3", a.music, "audio/mpeg"],
]) {
  execFileSync("npx", ["wrangler", "r2", "object", "put", `${a.bucket}/${key}`, "--file", file, "--content-type", type, ...where], { stdio: "pipe" });
  console.log(`${a.target}: ${key}  ${(fs.statSync(file).size / 1048576).toFixed(1)} MB`);
}
fs.rmSync(poster);
