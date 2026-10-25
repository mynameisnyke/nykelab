import { expect, test } from "@playwright/test";
import { formatCoords, placeLine } from "../src/lib/caption";

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
    // trip-level: place only, never invented coordinates
    expect(placeLine({ ...base, place: "Grand Teton and Yellowstone, Wyoming", geo: null })).toBe("Grand Teton and Yellowstone, Wyoming");
    expect(placeLine({ ...base, place: "Lisbon, Portugal", geo: { lat: 0, lon: 0, source: "trip" } })).toBe("Lisbon, Portugal");
    // a photo with only the city fields read from its tags
    expect(placeLine({ place: "", city: "Bogotá", region: "", country: "Colombia", geo: null })).toBe("Bogotá, Colombia");
    expect(placeLine({ place: "", city: "", region: "", country: "", geo: null })).toBe("");
  });
});
