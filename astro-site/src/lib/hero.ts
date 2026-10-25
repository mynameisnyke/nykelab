// What may fill the screen. A hero or a full-bleed block is shown across the whole width, so a still needs at least 2400 px on its long
// edge (`heroOk`); smaller ones (older camera files, small crops) stay in grids and normal-size views, where they look fine.
export interface HeroCandidate {
  type: "image" | "video";
  orientation: "landscape" | "portrait" | "unknown";
  heroOk: boolean;
}

/**
 * The item to use as a page's hero: the first landscape clip, else the first landscape still that is sharp enough.
 * When a collection has neither, the first landscape still is used anyway and `soft` says so (so it can be reported).
 */
export function pickHero(media: HeroCandidate[]): { index: number; soft: boolean } {
  const wide = (m: HeroCandidate) => m.orientation !== "portrait";
  const clip = media.findIndex((m) => m.type === "video" && wide(m));
  if (clip >= 0) return { index: clip, soft: false };
  const sharp = media.findIndex((m) => m.type === "image" && wide(m) && m.heroOk);
  if (sharp >= 0) return { index: sharp, soft: false };
  const any = media.findIndex((m) => m.type === "image" && wide(m));
  return { index: Math.max(0, any), soft: any >= 0 };
}
