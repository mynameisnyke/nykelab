// src/models/Media.ts
import {
  IMedia,
  LandmarkAnnotation,
  DominantColorsAnnotation,
  VideoUrls,
  ImageUrls,
  MediaType,
  OrientationType,
} from "../types/media";
export class Media implements IMedia {
  id: string = '';
  collection?: string;
  posterUrl?: string;
  name?: string;
  caption?: string;
  location?: string;
  fileType: MediaType = MediaType.Unknown;
  city?: string;
  country?: string;
  labels?: string[];
  dominantColors?: DominantColorsAnnotation;
  dateAdded?: Date;
  dateCreated?: Date;
  status: string = '';
  galleries?: string[];
  orientation: OrientationType = OrientationType.Unknown;
  src: string = '';
  isVertical: boolean = false;
  landmarkAnnotation?: LandmarkAnnotation;

  // URLs for different media types
  videoUrls?: VideoUrls; // URLs for videos
  imageUrls?: ImageUrls; // URLs for images

  constructor(data: Partial<IMedia>) {
    Object.assign(this, data);
    this.initialize();
  }

  initialize(): void {
    // Here you can add logic to initialize or process the media data
    // For example:
    this.isVertical = this.determineVertical();
    // ... any other initialization logic
  }

  private determineVertical(): boolean {
    // Logic to determine if the media is vertical or not
    return this.orientation === "portrait"; // Example logic
  }

  // Add any additional methods that are relevant to the Media class
}
