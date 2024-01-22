// src/models/Media.ts
import {
  IMedia,
  LandmarkAnnotation,
  DominantColorsAnnotation,
} from "../types/media";

export class Media implements IMedia {
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
  galleries?: string[];
  orientation: string;
  src: string;
  isVertical: boolean;
  landmarkAnnotation?: LandmarkAnnotation;

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
