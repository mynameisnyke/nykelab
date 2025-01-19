// useSrcSetter.ts

import { computed } from "vue";
import { Media } from "../models/media";
import { MediaType } from "../types/media";

export function useSrcSetter(media: Media, mobile: boolean) {
  const updatedSrc = computed(() => {
    switch (media.fileType) {
      case MediaType.Video:
        if (mobile) {
          // If mobile is true, update src to h264_mobile
          return media.videoUrls?.h264;
        } else {
          // If not mobile, use the original src
          return media.videoUrls?.webm;
        }
      case MediaType.Image:
        if (mobile) {
          // If mobile is true, update src to h264_mobile
          return media.imageUrls?.webpSmall;
        } else {
          // If not mobile, use the original src
          return media.imageUrls?.webpFull;
        }
    }
  });
  return {
    updatedSrc,
  };
}
