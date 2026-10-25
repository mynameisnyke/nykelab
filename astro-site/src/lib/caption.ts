// The line under a photograph or clip: where it was made, with GPS coordinates when we have them.
//   "Oaxaca de Juárez, Mexico · 17.061° N, 96.726° W"       coordinates known (from the photo or matched to a phone photo)
//   "Grand Teton and Yellowstone, Wyoming"                    only the trip is known
import type { ApiMedia } from "../../../worker/src/types";

type Geo = NonNullable<ApiMedia["geo"]>;

/** 17.0609, -96.7256 -> "17.061° N, 96.726° W". Approximate matches carry two decimals and print as such. */
export function formatCoords(g: Geo): string {
  const dec = g.source === "phone-approx" ? 2 : 3;
  const part = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(dec)}° ${v >= 0 ? pos : neg}`;
  return `${part(g.lat, "N", "S")}, ${part(g.lon, "E", "W")}`;
}

/** Place and coordinates for one item; "" when nothing is known. */
export function placeLine(m: Pick<ApiMedia, "place" | "geo" | "city" | "region" | "country">): string {
  const place = m.place || [m.city, m.region || m.country].filter(Boolean).join(", ");
  return [place, m.geo && m.geo.source !== "trip" ? formatCoords(m.geo) : ""].filter(Boolean).join(" · ");
}
