import { expect, test } from "@playwright/test";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildArgs, convert, isHdr, localCapture, makePoster, parseLocation, probe, summarize } from "../scripts/video/convert.mjs";
import { slugify, titleCase } from "../scripts/video/upload.mjs";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
test.skip(!hasFfmpeg, "ffmpeg is not installed");

const hex = () => [...crypto.getRandomValues(new Uint8Array(4))].map((b) => b.toString(16).padStart(2, "0")).join("");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nykelab-video-"));
test.afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

/** A real test clip: moving pattern + a sine tone, with the metadata phones record. */
function makeClip(file: string, o: { w: number; h: number; fps: number; secs?: number; location?: string; created?: string }) {
  execFileSync("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error",
    "-f", "lavfi", "-i", `testsrc2=size=${o.w}x${o.h}:rate=${o.fps}:duration=${o.secs ?? 2}`,
    "-f", "lavfi", "-i", `sine=frequency=440:duration=${o.secs ?? 2}`,
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-c:a", "aac",
    ...(o.location ? ["-metadata", `location=${o.location}`] : []),
    ...(o.created ? ["-metadata", `creation_time=${o.created}`] : []),
    file,
  ]);
}

test.describe("converter arguments and tags", () => {
  const info = { fps: 24, hdr: false, hasAudio: true };
  test("silent, H.264 High, yuv420p, faststart, one keyframe a second", () => {
    const a = buildArgs(info, "in.mov", "out.mp4").join(" ");
    expect(a).toContain("-an");
    expect(a).not.toContain("-c:a");
    expect(a).toMatch(/-c:v libx264 -profile:v high/);
    expect(a).toContain("-pix_fmt yuv420p");
    expect(a).toContain("-movflags +faststart");
    expect(a).toContain("-g 24 -keyint_min 24");
    expect(a).toContain("min(iw,1920)"); // fit inside 1920 without ever enlarging
  });
  test("frame rate is capped at 30 only when the source is faster", () => {
    expect(buildArgs({ ...info, fps: 60 }, "i", "o").join(" ")).toContain("fps=30");
    expect(buildArgs({ ...info, fps: 29.97 }, "i", "o").join(" ")).not.toContain("fps=30");
  });
  test("HDR sources are tone-mapped to SDR, SDR sources are not", () => {
    expect(buildArgs({ ...info, hdr: true }, "i", "o").join(" ")).toContain("tonemap=tonemap=hable");
    expect(buildArgs(info, "i", "o").join(" ")).not.toContain("tonemap");
    expect(isHdr({ color_transfer: "arib-std-b67" })).toBe(true);
    expect(isHdr({ color_transfer: "smpte2084" })).toBe(true);
    expect(isHdr({ color_transfer: "bt709" })).toBe(false);
  });
  test("audio is kept only on request", () => {
    expect(buildArgs(info, "i", "o", { keepAudio: true }).join(" ")).toContain("-c:a aac");
  });
  test("GPS and capture time are read from phone tags", () => {
    expect(parseLocation({ location: "+06.2442-075.5812/" })).toEqual({ lat: 6.2442, lon: -75.5812 });
    expect(parseLocation({ "com.apple.quicktime.location.ISO6709": "+40.7128-074.0060+010.000/" })).toEqual({ lat: 40.7128, lon: -74.006 });
    expect(parseLocation({ location: "+00.0000+000.0000/" })).toBeNull();
    expect(parseLocation({})).toBeNull();
    expect(localCapture({ "com.apple.quicktime.creationdate": "2023-05-12T12:02:11-0500", creation_time: "2023-05-12T17:02:11Z" })).toBe("2023-05-12T12:02:11");
    expect(localCapture({ creation_time: "2023-05-12T17:02:11.000000Z" })).toBe("2023-05-12T17:02:11");
    expect(localCapture({ creation_time: "1970-01-01T00:00:00Z" })).toBeNull();
  });
  test("a phone clip shot upright but stored rotated reports its displayed size", () => {
    const s = summarize({ streams: [{ codec_type: "video", codec_name: "hevc", width: 1920, height: 1080, avg_frame_rate: "30/1", side_data_list: [{ rotation: -90 }] }], format: { duration: "10" } });
    expect([s.width, s.height]).toEqual([1080, 1920]);
  });
  test("folder names become collection names and slugs", () => {
    expect(slugify("Bogotá")).toBe("bogota");
    expect(slugify("  New York 2021 ")).toBe("new-york-2021");
    expect(titleCase("bogota")).toBe("Bogota");
    expect(titleCase("new-york")).toBe("New York");
  });
});

test.describe("converting real clips", () => {
  test.describe.configure({ mode: "serial" }); // each one runs ffmpeg flat out
  test("a 2560x1440 60 fps clip with sound becomes a 1920x1080, 30 fps, silent, faststart H.264 MP4 with a poster", async () => {
    const src = path.join(tmp, "wide.mov");
    makeClip(src, { w: 2560, h: 1440, fps: 60 });
    const out = path.join(tmp, "wide.mp4");
    const { source, output } = await convert(src, out, { preset: "veryfast" });
    expect(source.hasAudio).toBe(true);
    expect(output.codec).toBe("h264");
    expect([output.width, output.height]).toEqual([1920, 1080]);
    expect(output.fps).toBeLessThanOrEqual(30.01);
    expect(output.hasAudio).toBe(false);
    expect(output.duration).toBeGreaterThan(1.8);
    // the index (moov) must come before the media data so playback can start before the download ends
    const head = fs.readFileSync(out).subarray(0, 4096).toString("latin1");
    expect(head.indexOf("moov")).toBeGreaterThan(-1);
    expect(head.indexOf("moov")).toBeLessThan(head.indexOf("mdat") === -1 ? Infinity : head.indexOf("mdat"));
    const pix = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=pix_fmt,profile", "-of", "csv=p=0", out]).toString().trim();
    expect(pix).toBe("High,yuv420p");
    const poster = path.join(tmp, "wide.jpg");
    await makePoster(out, poster);
    const pi = await probe(poster).catch(() => null);
    expect(fs.statSync(poster).size).toBeGreaterThan(2000);
    expect(pi?.width).toBe(1920);
  });

  test("a portrait clip keeps its orientation and is capped on its long edge", async () => {
    const src = path.join(tmp, "tall.mov");
    makeClip(src, { w: 1440, h: 2560, fps: 30 });
    const out = path.join(tmp, "tall.mp4");
    const { output } = await convert(src, out, { preset: "veryfast" });
    expect([output.width, output.height]).toEqual([1080, 1920]);
  });

  test("small clips are not enlarged", async () => {
    const src = path.join(tmp, "small.mov");
    makeClip(src, { w: 640, h: 360, fps: 24 });
    const out = path.join(tmp, "small.mp4");
    const { output } = await convert(src, out, { preset: "veryfast" });
    expect([output.width, output.height]).toEqual([640, 360]);
  });

  test("iPhone-style HLG HDR footage comes out as standard SDR (not washed out)", async () => {
    const src = path.join(tmp, "hlg.mov");
    execFileSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=1920x1080:rate=30:duration=2",
      "-c:v", "libx264", "-profile:v", "high10", "-pix_fmt", "yuv420p10le", "-preset", "ultrafast",
      "-x264-params", "colorprim=bt2020:transfer=arib-std-b67:colormatrix=bt2020nc", src]);
    const out = path.join(tmp, "hlg.mp4");
    const { source, output } = await convert(src, out, { preset: "veryfast" });
    expect(source.hdr).toBe(true);
    const f = execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=pix_fmt,color_transfer,color_primaries", "-of", "csv=p=0", out]).toString().trim();
    expect(f).toBe("yuv420p,bt709,bt709");
    expect(output.hdr).toBe(false);
  });

  test("output is small enough for a background loop", async () => {
    const src = path.join(tmp, "size.mov");
    makeClip(src, { w: 1920, h: 1080, fps: 30, secs: 5 });
    const out = path.join(tmp, "size.mp4");
    const { output } = await convert(src, out, { preset: "veryfast" });
    expect(output.bytes / 5).toBeLessThan(1_100_000); // under ~8.8 Mbit/s even for a busy test pattern
  });
});

// ---- the whole path: watcher -> converter -> admin API -> storage -> page ---------------------------
test.describe("watcher end to end (dev server)", () => {
  test.describe.configure({ mode: "serial" });
  const folder = `vidtest-${hex()}`;
  const slug = slugify(folder);
  const watch = path.join(tmp, "in");
  const out = path.join(tmp, "out");
  let rows: { id: string; urls: { main: string; poster?: string }; place: string; capturedAt: string | null; type: string; width: number; height: number }[] = [];

  test.beforeAll(async () => {
    execFileSync("npx", ["wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", ".wrangler/state"], { stdio: "ignore" });
    fs.mkdirSync(path.join(watch, folder), { recursive: true });
    makeClip(path.join(watch, folder, "a-hero.mov"), { w: 1920, h: 1080, fps: 30, location: "+06.2442-075.5812/", created: "2023-05-12T12:02:11Z" });
    makeClip(path.join(watch, folder, "b-second.mov"), { w: 1920, h: 1080, fps: 30 });
  });
  test.afterAll(async ({ request }) => {
    for (const m of rows) await request.delete(`/api/admin/media/${m.id}`);
    await request.delete(`/api/admin/collections/${slug}`);
  });

  test("dropping clips into a folder converts them, creates the collection and uploads them", async ({ request }) => {
    const r = spawnSync("node", ["scripts/video-watcher.mjs", "--once", "--watch", watch, "--out", out, "--api", "http://localhost:4322"], { encoding: "utf8", timeout: 120_000 });
    expect(r.stdout + r.stderr).toContain("uploaded");
    expect(r.stdout).not.toContain("FAILED");
    const res = await (await request.get(`/api/media?collection=${slug}`)).json();
    rows = res.media;
    expect(rows).toHaveLength(2);
    for (const m of rows) {
      expect(m.type).toBe("video");
      expect(m.urls.main).toMatch(/^\/m\/[a-f0-9]{12}\/main\.mp4$/);
      expect(m.urls.poster).toMatch(/^\/m\/[a-f0-9]{12}\/poster\.jpg$/);
      expect([m.width, m.height]).toEqual([1920, 1080]);
    }
    // converted files and a poster each are kept next to the watch folder's output
    expect(fs.existsSync(path.join(out, folder, "a-hero.mp4"))).toBe(true);
    expect(fs.existsSync(path.join(out, folder, "a-hero.jpg"))).toBe(true);
    // the clip's own GPS + capture time filled in the place, like a photo's
    const hero = rows.find((m) => m.place);
    expect(hero?.place).toMatch(/^Medellín/);
    expect(hero?.capturedAt).toBe("2023-05-12T12:02:11"); // the clip's creation_time, kept as written
  });

  test("running it again does nothing (files already done are remembered)", () => {
    const r = spawnSync("node", ["scripts/video-watcher.mjs", "--once", "--watch", watch, "--out", out, "--api", "http://localhost:4322"], { encoding: "utf8", timeout: 60_000 });
    expect(r.stdout).not.toContain("converting");
  });

  test("the stored video streams with range requests and has the right types", async ({ request }) => {
    const url = rows[0].urls.main;
    const ranged = await request.get(url, { headers: { Range: "bytes=0-999" } });
    expect(ranged.status()).toBe(206);
    expect(ranged.headers()["content-type"]).toContain("video/mp4");
    expect(ranged.headers()["content-range"]).toMatch(/^bytes 0-999\//);
    const poster = await request.get(rows[0].urls.poster!);
    expect(poster.status()).toBe(200);
    expect(poster.headers()["content-type"]).toContain("image/jpeg");
  });

  test("the page: muted inline loops that play only while on screen", async ({ page, isMobile }) => {
    test.skip(!!isMobile, "scroll timing is checked on desktop");
    await page.goto(`/${slug}`);
    const videos = page.locator("video[data-media]");
    await expect(videos).toHaveCount(2);
    for (const v of await videos.all()) {
      await expect(v).toHaveAttribute("muted", "");
      await expect(v).toHaveAttribute("playsinline", "");
      await expect(v).toHaveAttribute("loop", "");
      expect(await v.getAttribute("autoplay")).toBeNull();
      expect(await v.getAttribute("poster")).toMatch(/poster\.jpg$/);
    }
    const state = (i: number) => videos.nth(i).evaluate((el: HTMLVideoElement) => ({ paused: el.paused, muted: el.muted, hasSrc: !!el.currentSrc, t: el.currentTime }));
    // hero is on screen: loads and plays, muted
    await expect.poll(async () => (await state(0)).paused, { timeout: 15_000 }).toBe(false);
    expect((await state(0)).muted).toBe(true);
    // the second clip is below the fold: not playing
    expect((await state(1)).paused).toBe(true);
    // scroll to it: it plays, the hero stops
    await videos.nth(1).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 200));
    await expect.poll(async () => (await state(1)).paused, { timeout: 15_000 }).toBe(false);
    await expect.poll(async () => (await state(0)).paused, { timeout: 10_000 }).toBe(true);
    // time actually advances while playing
    const t1 = (await state(1)).t;
    await page.waitForTimeout(700);
    expect((await state(1)).t).toBeGreaterThan(t1);
  });

  test("with reduce-motion on, nothing plays and no video file is requested (poster only)", async ({ browser, isMobile }) => {
    test.skip(!!isMobile, "same behaviour on both; checked once");
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    const requested: string[] = [];
    page.on("request", (r) => /main\.mp4/.test(r.url()) && requested.push(r.url()));
    await page.goto(`/${slug}`);
    await page.waitForTimeout(2500);
    const first = await page.locator("video[data-media]").first().evaluate((el: HTMLVideoElement) => ({ paused: el.paused, src: el.currentSrc }));
    expect(first.paused).toBe(true);
    expect(first.src).toBe("");
    expect(requested).toEqual([]);
    await ctx.close();
  });
});
