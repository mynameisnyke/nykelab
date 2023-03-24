export interface Media {
  name?: string;
  fileType: string;
  id: string;
  galleries?: [string];
  dateCreated?: string;
  orientation: string;
  src: string;
}
