import type { ApiMedia } from "./api";
import { Media } from "../models/media";
import { MediaType, OrientationType } from "../types/media";

// Adapts an API row to the Media model the existing display components use.
export function toMedia(a: ApiMedia): Media {
  const main = a.urls.main;
  const small = a.urls.small ?? main;
  return new Media({
    id: a.id,
    collection: a.collection,
    name: a.place || a.caption.split("\n")[0] || undefined,
    caption: a.caption,
    location: a.place,
    fileType: a.type === "video" ? MediaType.Video : MediaType.Image,
    orientation: a.orientation as OrientationType,
    posterUrl: a.urls.poster,
    imageUrls:
      a.type === "image"
        ? { webpFull: main, webpSmall: small, jpegFull: main, jpegSmall: small }
        : undefined,
    videoUrls: a.type === "video" ? { webm: main, h264: main } : undefined,
  });
}
