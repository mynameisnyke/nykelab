#!/usr/bin/env node
// Puts the Infinite Azure page's own media into storage under azure/: the looping background, its poster frame, the music,
// and the six hit sounds (azure/hit-1.wav .. hit-6.wav) that fire as photographs land.
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
    hits: { type: "string", default: "/Volumes/Whiskey/hit_clips" },
    bucket: { type: "string", default: "nykelab-media" },
  },
});
const where = a.target === "remote" ? ["--remote"] : ["--local", "--persist-to", ".wrangler/state"];

const poster = path.join(os.tmpdir(), "azure-background.jpg");
// The song as delivered ("if azure.mp3") is an AAC stream in a *fragmented* MP4 (80 segments, no overall index), which a browser has to
// scan before it can start. Remux it (the audio is copied, not re-encoded) into an ordinary MP4 audio file with the index up front.
const song = path.join(os.tmpdir(), "azure-song.m4a");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", a.music, "-vn", "-c:a", "copy", "-movflags", "+faststart", song]);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", "3", "-i", a.video, "-frames:v", "1", "-vf", "scale=1920:-2", "-q:v", "4", poster]);

// only the six clips chosen for this page (hit_01 .. hit_06); the folder holds more
const hitFiles = fs.readdirSync(a.hits).filter((f) => /^hit_0[1-6]_.*\.wav$/.test(f)).sort();
if (hitFiles.length !== 6) throw new Error(`expected hit_01..hit_06 in ${a.hits}, found ${hitFiles.length}`);

for (const [key, file, type] of [
  ["azure/background.mp4", a.video, "video/mp4"],
  ["azure/background.jpg", poster, "image/jpeg"],
  ["azure/infinite-azure.m4a", song, "audio/mp4"],
  ...hitFiles.map((f, i) => [`azure/hit-${i + 1}.wav`, path.join(a.hits, f), "audio/wav"]),
]) {
  execFileSync("npx", ["wrangler", "r2", "object", "put", `${a.bucket}/${key}`, "--file", file, "--content-type", type, ...where], { stdio: "pipe" });
  console.log(`${a.target}: ${key}  ${(fs.statSync(file).size / 1048576).toFixed(1)} MB`);
}
fs.rmSync(poster);
fs.rmSync(song);
