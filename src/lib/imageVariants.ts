// Browser-side media preparation for the admin uploader. Doing this here means
// the Worker needs no image tooling: we upload ready-to-serve WebP variants.

export const MAIN_EDGE = 2400; // long edge of the full-size variant
export const SMALL_EDGE = 900; // long edge of the mobile / thumbnail variant

export interface PreparedImage {
  main: Blob;
  small: Blob;
  width: number;
  height: number;
  orientation: "landscape" | "portrait";
}

export interface PreparedVideo {
  file: File;
  poster: Blob;
  width: number;
  height: number;
  orientation: "landscape" | "portrait";
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Browsers without WebP encoding silently fall back to PNG; ask for JPEG then.
    canvas.toBlob(
      (webp) => {
        if (webp && webp.type === "image/webp") return resolve(webp);
        canvas.toBlob(
          (jpg) => (jpg ? resolve(jpg) : reject(new Error("Could not encode image"))),
          "image/jpeg",
          quality,
        );
      },
      "image/webp",
      quality,
    );
  });
}

function drawScaled(source: CanvasImageSource, w: number, h: number, maxEdge: number) {
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  let bitmap: ImageBitmap;
  try {
    // from-image honours EXIF rotation so portrait phone shots aren't sideways.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error(`${file.name}: this browser can't decode that image (HEIC? export as JPEG first)`);
  }
  const { width, height } = bitmap;
  const [main, small] = await Promise.all([
    canvasToBlob(drawScaled(bitmap, width, height, MAIN_EDGE), 0.86),
    canvasToBlob(drawScaled(bitmap, width, height, SMALL_EDGE), 0.8),
  ]);
  bitmap.close();
  return {
    main,
    small,
    width,
    height,
    orientation: height > width ? "portrait" : "landscape",
  };
}

export async function prepareVideo(file: File): Promise<PreparedVideo> {
  if (file.type !== "video/mp4" && file.type !== "video/webm") {
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
    const poster = await canvasToBlob(drawScaled(video, width, height, MAIN_EDGE), 0.82);
    return { file, poster, width, height, orientation: height > width ? "portrait" : "landscape" };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function newMediaId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
