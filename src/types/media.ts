// Media Type

export interface IMedia {
  id: string;
  collection?: string;
  posterUrl?: string;
  name?: string;
  caption?: string;
  location?: string;
  fileType: MediaType;
  city?: string;
  country?: string;
  labels?: string[];
  dominantColors?: DominantColorsAnnotation;
  dateAdded?: Date;
  dateCreated?: Date;
  status?: string;
  isFullscreen?: boolean;
  orientation: OrientationType;
  landmarkAnnotation?: LandmarkAnnotation;

  // URLs for different media types
  videoUrls?: VideoUrls; // URLs for videos
  imageUrls?: ImageUrls; // URLs for images
}

export enum MediaType {
  Video = "video",
  Image = "image",
  Audio = "audio",
  Unknown = "unknown",
}

export enum OrientationType {
  Landscape = "landscape",
  Portrait = "portrait",
  Unknown = "unknown",
}

// URLs for videos (customize the keys as needed)
export interface VideoUrls {
  webm?: string;
  h264?: string;
}

// URLs for images (customize the keys as needed)
export interface ImageUrls {
  webpFull?: string;
  webpSmall?: string;
  jpegFull?: string;
  jpegSmall?: string;
}

export interface LandmarkAnnotation {
  description: string;
  location: Location;
}

interface Location {
  latLng: LatLng;
}

interface LatLng {
  latitude: number;
  longitude: number;
}

interface Color {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

interface ColorInfo {
  color: Color;
  score: number;
  pixelFraction: number;
}

export interface DominantColorsAnnotation {
  colors: ColorInfo[];
}
