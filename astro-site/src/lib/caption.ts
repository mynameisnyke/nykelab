// The line under a photograph or clip: where it was made, with GPS coordinates when we have them.
//   "Oaxaca de Juárez, Mexico · 17.061° N, 96.726° W"       exact: from the photo, or matched to a phone photo taken at the same time
//   "New Jersey · 40.79° N, 74.00° W"                           approximate (two decimals, about a kilometre)
import type { ApiMedia } from "../../../worker/src/types";

type Geo = NonNullable<ApiMedia["geo"]>;

/** 17.0609, -96.7256 -> "17.061° N, 96.726° W". Approximate positions carry two decimals and print as such. */
export function formatCoords(g: Geo): string {
  const dec = g.source === "exif" || g.source === "phone" ? 3 : 2; // matches by day or trip are only good to about a kilometre
  const part = (v: number, pos: string, neg: string) => `${Math.abs(v).toFixed(dec)}° ${v >= 0 ? pos : neg}`;
  return `${part(g.lat, "N", "S")}, ${part(g.lon, "E", "W")}`;
}

type Located = Pick<ApiMedia, "place" | "geo" | "city" | "region" | "country">;

/** The place name for one item ("" when nothing is known). */
export const placeText = (m: Located): string => m.place || [m.city, m.region || m.country].filter(Boolean).join(", ");

/** The coordinates as text plus a Google Maps link to them, or null. */
export function coordsLink(m: Located): { text: string; href: string } | null {
  if (!m.geo) return null;
  return { text: formatCoords(m.geo), href: `https://www.google.com/maps/search/?api=1&query=${m.geo.lat},${m.geo.lon}` };
}

/** Place and coordinates as plain text; "" when nothing is known. */
export function placeLine(m: Located): string {
  return [placeText(m), coordsLink(m)?.text ?? ""].filter(Boolean).join(" · ");
}
