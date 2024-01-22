// Media Type

export interface IMedia {
  id: string;
  name?: string;
  caption?: string;
  location?: string;
  fileType: string;
  city?: string;
  country?: string;
  labels?: string[];
  dominantColors?: DominantColorsAnnotation;
  dateAdded?: Date;
  dateCreated?: Date;
  status: string;
  isFullscreen?: boolean;
  orientation: string;
  src: string;
  landmarkAnnotation?: LandmarkAnnotation;
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
