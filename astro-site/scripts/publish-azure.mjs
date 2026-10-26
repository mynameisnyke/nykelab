#!/usr/bin/env node
// Puts the Infinite Azure page's own media into storage under azure/: the looping background, its poster frame, the music,
// and the six hit sounds (azure/hit-1.wav .. hit-6.wav) that fire as photographs land.
// Read-only on the sources. Rerun to replace them (same keys).
//
//   node scripts/publish-azure.mjs                  local storage (what `npm run dev` serves)
//   node scripts/publish-azure.mjs --target remote  the live bucket
import { execFileSync, spawnSync } from "node:child_process";
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
// The song as delivered ("if azure.mp3") is 13 minutes of AAC at 159 kbps (16 MB) in a *fragmented* MP4 with no overall index,
// mastered loud (-13 LUFS, peaks over 0 dBFS) so it also drowned out the hit sounds (about -19 LUFS). The web copy is:
//  - re-encoded to AAC-LC 64 kbps stereo (about 6 MB; the quality is plenty for a background loop),
//  - loudness-normalised to -19 LUFS with a -1.5 dB true-peak ceiling (two passes, linear, so the dynamics are untouched),
//  - written with the index up front (+faststart) so playback can start from the first bytes.
// It goes to a new key (infinite-azure-web.m4a); the original upload (infinite-azure.m4a) is left in storage.
const song = path.join(os.tmpdir(), "azure-song.m4a");
const first = spawnSync("ffmpeg", ["-hide_banner", "-nostats", "-i", a.music, "-af", "loudnorm=I=-19:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-"], { encoding: "utf8", maxBuffer: 1 << 26 });
const m = JSON.parse(first.stderr.slice(first.stderr.lastIndexOf("{"), first.stderr.lastIndexOf("}") + 1));
const hasAudioToolbox = execFileSync("ffmpeg", ["-hide_banner", "-encoders"], { encoding: "utf8" }).includes(" aac_at ");
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", a.music, "-vn",
  "-af", `loudnorm=I=-19:TP=-1.5:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true,aresample=44100`,
  "-c:a", hasAudioToolbox ? "aac_at" : "aac", "-b:a", hasAudioToolbox ? "64k" : "80k", "-ac", "2", "-movflags", "+faststart", song]);
execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-ss", "3", "-i", a.video, "-frames:v", "1", "-vf", "scale=1920:-2", "-q:v", "4", poster]);

// only the six clips chosen for this page (hit_01 .. hit_06); the folder holds more
const hitFiles = fs.readdirSync(a.hits).filter((f) => /^hit_0[1-6]_.*\.wav$/.test(f)).sort();
if (hitFiles.length !== 6) throw new Error(`expected hit_01..hit_06 in ${a.hits}, found ${hitFiles.length}`);

for (const [key, file, type] of [
  ["azure/background.mp4", a.video, "video/mp4"],
  ["azure/background.jpg", poster, "image/jpeg"],
  ["azure/infinite-azure-web.m4a", song, "audio/mp4"],
  ...hitFiles.map((f, i) => [`azure/hit-${i + 1}.wav`, path.join(a.hits, f), "audio/wav"]),
]) {
  execFileSync("npx", ["wrangler", "r2", "object", "put", `${a.bucket}/${key}`, "--file", file, "--content-type", type, ...where], { stdio: "pipe" });
  console.log(`${a.target}: ${key}  ${(fs.statSync(file).size / 1048576).toFixed(1)} MB`);
}
fs.rmSync(poster);
fs.rmSync(song);
