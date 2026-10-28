// The Mini DV tapes on the desk: one per captured video file. The drawer on /mini-dv lays them out in this order.
// `file` is the name of the mp4 as captured (the dev server reads it straight from the Mini DV folder, see astro.config.mjs);
// `seconds` is its length, from ffprobe.
export interface Tape {
  id: string;
  title: string;
  /** a second line for the label when the title alone is not the whole story */
  note?: string;
  file: string;
  seconds: number;
}

export const TAPES: readonly Tape[] = [
  { id: "first-walk-uws", title: "First Walk, First Christmas in UWS", file: "FIRST WALK, FIRST CHRISTMAS IN UWS.mp4", seconds: 2226 },
  { id: "life-before-moving", title: "Life Before Moving", note: "June – September 2024", file: "Life Before Moving June - September 2024.mp4", seconds: 3599 },
  { id: "nyc-2023", title: "NYC 2023", file: "NYC 2023.mp4", seconds: 886 },
  { id: "oaxaca", title: "Oaxaca", file: "OAXACA.mp4", seconds: 3545 },
  { id: "oaxaca-p2", title: "Oaxaca P2", file: "OAXACA P2.mp4", seconds: 628 },
  { id: "roy-seo-toko-bbq-alice", title: "Roy Seo First Time Toko BBQ Alice", file: "ROY SEO FIRST TIME TOKO BBQ ALICE.mp4", seconds: 3600 },
  { id: "sf", title: "SF", file: "SF.mp4", seconds: 3039 },
  { id: "summer-25", title: "Summer 25", file: "SUMMER 25.mp4", seconds: 3387 },
  // the file on disk is spelled "Sunmer 26.mp4"; the label reads Summer
  { id: "summer-26", title: "Summer 26", file: "Sunmer 26.mp4", seconds: 3319 },
  { id: "thanksgiving", title: "Thanksgiving", file: "Thanksgiving.mp4", seconds: 3600 },
  { id: "thanksgiving-one", title: "Thanksgiving One", file: "Thanksgiving One.mp4", seconds: 2703 },
  { id: "toko-8-11-months", title: "Toko 8–11 Months", file: "Toko 8-11 Months.mp4", seconds: 1846 },
  { id: "undokai-2023", title: "Undokai 2023", file: "UNDOKAI 2023.mp4", seconds: 2495 },
  { id: "winter-spring-2026", title: "Winter–Spring 2026", file: "winter-spring-2026.mp4", seconds: 3239 },
];

/** Where the browser fetches a tape's video: the local folder in dev, the media bucket (key minidv/<id>.mp4) once published. */
export const videoSrc = (t: Tape): string => (import.meta.env.DEV ? `/minidv-local/${encodeURIComponent(t.file)}` : `/m/minidv/${t.id}.mp4`);

export const runtime = (seconds: number): string => {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};
