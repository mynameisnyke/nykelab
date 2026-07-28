// src/composables/useMaxWidth.ts
import { Media } from "../models/media";

export function useMaxWidthClass(media: Media): string {
  // Default max-width is 85% of the container
  let classString = "max-w-[85%]";

  // After the md breakpoint, use 600px or 1285px depending on media.isVertical
  if (media.isVertical) {
    classString += " md:max-w-[600px] 2xl:max-w-[1285px]";
  } else {
    classString += " md:max-w-[600px] xl:max-w-[1230px] 2xl:max-w-[1285px]";
  }
  return classString;
}
export function useMaxWidthClassDual(media: Media): string {
  // Default max-width is 85% of the container
  let classString = "max-w-[85%] md:max-w-[600px]";

  return classString;
}
