// Browser-side helpers for the admin uploader. Photos are NOT resized here any more:
// the original is uploaded and Cloudflare generates sized variants on demand.
// We only read the pixel size (EXIF-aware) so layout can reserve space.

export interface ImageInfo {
  width: number;
  height: number;
  orientation: "landscape" | "portrait";
}
export interface VideoInfo extends ImageInfo {
  poster: Blob;
}

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const VIDEO_TYPES = ["video/mp4", "video/webm"];

export async function readImageInfo(file: File): Promise<ImageInfo> {
  if (!IMAGE_TYPES.includes(file.type)) {
    throw new Error(`${file.name}: use JPEG, PNG or WebP (HEIC? export as JPEG first)`);
  }
  let bitmap: ImageBitmap;
  try {
    // from-image honours EXIF rotation so portrait phone shots aren't sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`${file.name}: this browser can't decode that image`);
  }
  const { width, height } = bitmap;
  bitmap.close();
  return { width, height, orientation: height > width ? "portrait" : "landscape" };
}

const POSTER_EDGE = 2400;

export async function prepareVideo(file: File): Promise<VideoInfo> {
  if (!VIDEO_TYPES.includes(file.type)) {
    throw new Error(`${file.name}: videos must be MP4 (H.264) or WebM`);
  }
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadeddata = () => resolve();
      video.onerror = () => reject(new Error(`${file.name}: could not read this video`));
    });
    // Poster frame: a moment in, to skip fade-ins/black first frames.
    video.currentTime = Math.min(1, (video.duration || 1) / 2);
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve();
    });
    const { videoWidth: width, videoHeight: height } = video;
    const scale = Math.min(1, POSTER_EDGE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const poster = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode poster"))), "image/jpeg", 0.82),
    );
    return { poster, width, height, orientation: height > width ? "portrait" : "landscape" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function newMediaId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
