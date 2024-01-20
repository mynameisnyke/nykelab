export interface Media {
  name?: string;
  fileType: string;
  id: string;
  galleries?: [string];
  dateCreated?: string;
  orientation: string;
  src: string;
  caption?: string;
  credit?: string;
  // Array of keyword descriptions of the media
  labels: [string];
  landmarkAnnotation?: LandmarkAnnotation
}

interface LandmarkAnnotation {
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