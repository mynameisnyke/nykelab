import { expect, test } from "@playwright/test";
import { coordsLink, formatCoords, placeLine } from "../src/lib/caption";

test.describe("photo captions", () => {
  test("coordinates read N/S and E/W with the right precision", () => {
    expect(formatCoords({ lat: 17.0609, lon: -96.7256, source: "phone" })).toBe("17.061° N, 96.726° W");
    expect(formatCoords({ lat: -22.9068, lon: -43.1729, source: "exif" })).toBe("22.907° S, 43.173° W");
    // an approximate phone match is only good to about a kilometre, so it is printed with two decimals
    expect(formatCoords({ lat: 6.25, lon: -75.57, source: "phone-approx" })).toBe("6.25° N, 75.57° W");
    expect(formatCoords({ lat: 35.68, lon: 139.69, source: "phone" })).toBe("35.680° N, 139.690° E");
  });

  test("a caption is the place, then the coordinates when they are known", () => {
    const base = { city: "", region: "", country: "" };
    expect(placeLine({ ...base, place: "Oaxaca de Juárez, Mexico", geo: { lat: 17.061, lon: -96.726, source: "phone" } })).toBe("Oaxaca de Juárez, Mexico · 17.061° N, 96.726° W");
    // only the trip is known: its place, with an approximate pin when the trip has one (two decimals), none when it does not
    expect(placeLine({ ...base, place: "New Jersey", geo: { lat: 40.79, lon: -74, source: "day" } })).toBe("New Jersey · 40.79° N, 74.00° W");
    expect(placeLine({ ...base, place: "Norway", geo: null })).toBe("Norway");
    expect(coordsLink({ ...base, place: "New Jersey", geo: { lat: 40.79, lon: -74, source: "day" } })?.href).toBe("https://www.google.com/maps/search/?api=1&query=40.79,-74");
    expect(coordsLink({ ...base, place: "Norway", geo: null })).toBeNull();
    // a photo with only the city fields read from its tags
    expect(placeLine({ place: "", city: "Bogotá", region: "", country: "Colombia", geo: null })).toBe("Bogotá, Colombia");
    expect(placeLine({ place: "", city: "", region: "", country: "", geo: null })).toBe("");
  });
});
