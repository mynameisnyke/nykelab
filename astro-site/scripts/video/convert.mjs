// Turns any camera or phone clip into a web-friendly, muted H.264 MP4 plus a poster frame.
// Pure helpers (probe parsing, ffmpeg arguments) are exported for tests; `convert` shells out to ffmpeg.
//
// Defaults suit what the site uses video for: short, silent, looping backgrounds that play inline.
//   - H.264 High, yuv420p, MP4 with the index up front (+faststart) so playback starts before the download ends
//   - no audio track at all (the page plays muted; dropping it also saves bytes)
//   - longest edge capped at 1920, frame rate capped at 30, bit rate capped so a 30 s clip stays small
//   - HDR phone footage (HLG / PQ) is tone-mapped to SDR, otherwise it looks grey and washed out
//   - a keyframe every second, so scrolling back to a clip restarts quickly
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG || "ffmpeg";
const FFPROBE = process.env.FFPROBE || "ffprobe";

export const DEFAULTS = {
  maxEdge: 1920,
  fpsCap: 30,
  crf: 23,
  maxRateMbps: 8,
  keepAudio: false,
  maxSeconds: 0, // 0 = keep the whole clip
  preset: "slow",
};

export const VIDEO_EXT = /\.(mov|mp4|m4v|mkv|avi|mts|m2ts|mxf|webm|3gp)$/i;

/** ffprobe -> the few facts the converter and the uploader need. */
export async function probe(file) {
  const { stdout } = await run(FFPROBE, ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file], { maxBuffer: 16 * 1024 * 1024 });
  return summarize(JSON.parse(stdout));
}

export function summarize(p) {
  const v = (p.streams ?? []).find((s) => s.codec_type === "video" && s.disposition?.attached_pic !== 1);
  if (!v) throw new Error("no video stream found");
  const rotation = Math.abs(Number((v.side_data_list ?? []).find((d) => "rotation" in d)?.rotation ?? v.tags?.rotate ?? 0)) % 360;
  const swap = rotation === 90 || rotation === 270;
  const [num, den] = String(v.avg_frame_rate || v.r_frame_rate || "0/1").split("/").map(Number);
  const tags = { ...(p.format?.tags ?? {}), ...(v.tags ?? {}) };
  return {
    codec: v.codec_name,
    width: swap ? v.height : v.width,
    height: swap ? v.width : v.height,
    fps: den ? num / den : 0,
    duration: Number(p.format?.duration ?? v.duration ?? 0),
    hasAudio: (p.streams ?? []).some((s) => s.codec_type === "audio"),
    transfer: v.color_transfer || "",
    hdr: isHdr(v),
    tags,
    bytes: Number(p.format?.size ?? 0),
  };
}

/** HLG (iPhone, many cameras) and PQ (HDR10 / Dolby Vision base) both need tone-mapping for an SDR page. */
export function isHdr(v) {
  return v.color_transfer === "arib-std-b67" || v.color_transfer === "smpte2084";
}

/** Fit inside edge x edge, never enlarging: ffmpeg's own "decrease" mode would still scale a small clip UP. */
const fit = (edge) => `scale=w='if(gt(iw,ih),min(iw,${edge}),-2)':h='if(gt(iw,ih),-2,min(ih,${edge}))':force_divisible_by=2`;

const HDR_TO_SDR = "zscale=t=linear:npl=100,format=gbrpf32le,zscale=p=bt709,tonemap=tonemap=hable:desat=0,zscale=t=bt709:m=bt709:r=tv";

/** The ffmpeg argument list for one conversion. Exported so tests can read it without running ffmpeg. */
export function buildArgs(info, input, output, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const filters = [];
  if (info.hdr) filters.push(HDR_TO_SDR);
  filters.push(fit(o.maxEdge));
  if (info.fps > o.fpsCap + 0.01) filters.push(`fps=${o.fpsCap}`);
  filters.push("format=yuv420p");
  const fps = info.fps > o.fpsCap + 0.01 ? o.fpsCap : info.fps || 30;
  const gop = Math.max(2, Math.round(fps)); // one keyframe a second
  const args = ["-y", "-hide_banner", "-loglevel", "error", "-i", input, "-map", "0:v:0"];
  if (o.keepAudio && info.hasAudio) args.push("-map", "0:a:0", "-c:a", "aac", "-b:a", "96k");
  else args.push("-an");
  args.push("-sn", "-dn", "-map_metadata", "-1");
  if (o.maxSeconds > 0) args.push("-t", String(o.maxSeconds));
  args.push(
    "-vf", filters.join(","),
    "-c:v", "libx264", "-profile:v", "high", "-preset", o.preset, "-crf", String(o.crf),
    "-maxrate", `${o.maxRateMbps}M`, "-bufsize", `${o.maxRateMbps * 2}M`,
    "-g", String(gop), "-keyint_min", String(gop), "-sc_threshold", "0",
    "-pix_fmt", "yuv420p", "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709", "-color_range", "tv",
    "-tag:v", "avc1", "-movflags", "+faststart",
    output,
  );
  return args;
}

export async function convert(input, output, opts = {}) {
  const info = await probe(input);
  await run(FFMPEG, buildArgs(info, input, output, opts), { maxBuffer: 16 * 1024 * 1024 });
  return { source: info, output: await probe(output) };
}

/** A still from just inside the clip, used as the poster (shown while the video loads and when motion is off). */
export async function makePoster(video, outJpg, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const info = await probe(video);
  const at = Math.min(0.5, Math.max(0, info.duration / 2));
  await run(FFMPEG, [
    "-y", "-hide_banner", "-loglevel", "error", "-ss", String(at), "-i", video, "-frames:v", "1",
    "-vf", fit(o.maxEdge),
    "-q:v", "3", outJpg,
  ]);
}

/** "+40.7128-074.0060+010.000/" (QuickTime / ISO 6709) -> { lat, lon } or null */
export function parseLocation(tags) {
  const raw = tags["com.apple.quicktime.location.ISO6709"] ?? tags.location ?? tags["location-eng"] ?? "";
  const m = /^([+-]\d+(?:\.\d+)?)([+-]\d+(?:\.\d+)?)/.exec(String(raw));
  if (!m) return null;
  const lat = Number(m[1]);
  const lon = Number(m[2]);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0) ? { lat, lon } : null;
}

/** Local wall-clock capture time like the photos use ("2023-05-12T12:02:11"), or null. */
export function localCapture(tags) {
  // Apple writes the local time with its offset; other cameras only have a UTC creation_time.
  const apple = tags["com.apple.quicktime.creationdate"];
  const m = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)/.exec(String(apple ?? tags.creation_time ?? ""));
  return m && !m[1].startsWith("0000") && !m[1].startsWith("1970") ? m[1] : null;
}
