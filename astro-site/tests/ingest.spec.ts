import { expect, test } from "@playwright/test";
import fs from "node:fs";
import { metaFromRaw, parseMeta, usableCaption } from "../../worker/src/ingest";
import { countryCode, findCity, nearestCity } from "../../worker/src/places";

// Photo files with known tags (tests/fixtures, made with exiftool; see README "Upload metadata").
const read = (n: string) => parseMeta(fs.readFileSync(`tests/fixtures/${n}.jpg`));

test.describe("reading a photo's own tags", () => {
  test("GPS photo: nearest city becomes the place; caption, camera and settings are read", async () => {
    const m = await read("gps");
    expect(m.capturedAt).toBe("2020-01-30T05:56:22");
    expect(m.camera).toBe("SONY ILCE-7M3");
    expect(m.lens).toBe("FE 85mm F1.8");
    expect([m.focal, m.aperture, m.iso, m.shutter]).toEqual([85, 1.8, 400, "1/250"]);
    expect(m.caption).toBe("Dusk over the valley from the balcony");
    expect(m.placeSource).toBe("gps");
    expect(m.city).toBe("Medellín");
    expect(m.country).toBe("Colombia");
    expect(m.place).toMatch(/^Medellín, .*Colombia$/);
    // the exact fix is kept privately; the public coordinates are the city's
    expect(m.gpsLat).toBeCloseTo(6.23417, 4);
    expect(m.gpsLon).toBeCloseTo(-75.56943, 4);
    expect(m.placeLat).not.toBe(m.gpsLat);
    expect(Math.abs((m.placeLat ?? 0) - 6.23417)).toBeLessThan(0.2);
  });

  test("Lightroom place text (IPTC/XMP) without GPS: used as written, caption from IPTC", async () => {
    const m = await read("iptc");
    expect(m.placeSource).toBe("tags");
    expect(m.city).toBe("Tarrytown");
    expect(m.region).toBe("New York");
    expect(m.country).toBe("United States");
    expect(m.countryCode).toBe("US");
    expect(m.place).toBe("Tarrytown, New York, United States");
    expect(m.caption).toBe("Afghan hound, best of breed");
    expect(m.capturedAt).toBe("2021-06-12T10:41:07");
    expect(m.gpsLat).toBeNull();
  });

  test("a place written by a person beats GPS", async () => {
    const m = await read("both");
    expect(m.placeSource).toBe("tags");
    expect(m.city).toBe("Cartagena de Indias");
    expect(m.country).toBe("Colombia");
    // coordinates come from the listed city (Cartagena), not from the GPS fix that points at Medellín
    expect(m.placeLat).toBeGreaterThan(9.5);
    expect(m.gpsLat).toBeCloseTo(6.23417, 4); // still stored, privately
  });

  test("camera-default captions are ignored, GPS still places the photo", async () => {
    const m = await read("junk");
    expect(m.caption).toBe("");
    expect(m.city).toBe("Reykjavík");
    expect(m.country).toBe("Iceland");
  });

  test("a file with no metadata yields empty values and never throws", async () => {
    const m = await read("bare");
    expect(m.caption).toBe("");
    expect(m.place).toBe("");
    expect(m.capturedAt).toBeNull();
    expect(m.gpsLat).toBeNull();
    expect((await parseMeta(new Uint8Array([1, 2, 3, 4]))).place).toBe("");
  });
});

test.describe("caption sanitising", () => {
  for (const junk of ["SONY DSC", "OLYMPUS DIGITAL CAMERA", "DSC01456", "IMG_4021", "  ", "ab", "12345", "Created with GIMP", "ILCE-7M3"]) {
    test(`ignores "${junk}"`, () => expect(usableCaption(junk, "SONY ILCE-7M3")).toBe(""));
  }
  test("keeps a real sentence", () => expect(usableCaption("  Best in show, Piers 92 ", "SONY ILCE-7M3")).toBe("Best in show, Piers 92"));
});

test.describe("place lookup", () => {
  test("nearest city", () => {
    expect(nearestCity(40.73, -73.99)?.city.name).toMatch(/^New York/); // not a neighbourhood like "East Village"
    expect(nearestCity(40.65, -73.95)?.city.name).toMatch(/^New York/); // Brooklyn
    expect(nearestCity(-22.91, -43.17)?.city.country).toBe("Brazil");
    expect(nearestCity(64.15, -21.94)?.city.name).toBe("Reykjavík");
  });
  test("country codes accept names, ISO2 and ISO3", () => {
    expect(countryCode("United States")).toBe("US");
    expect(countryCode("USA")).toBe("US");
    expect(countryCode("co")).toBe("CO");
    expect(countryCode("Narnia")).toBe("");
  });
  test("city names match ignoring accents and trailing words", () => {
    expect(findCity("medellin", "CO")?.name).toBe("Medellín");
    expect(findCity("Cartagena de Indias", "CO")?.lat).toBeGreaterThan(10);
    expect(findCity("Zzyzx Nowhere", "")).toBeNull();
  });
  test("far from any city: region and country, no misleading city", () => {
    // middle of Yellowstone: nearest listed city is far
    const m = metaFromRaw({ latitude: 44.46, longitude: -110.83 });
    expect(m.placeSource).toBe("gps");
    expect(m.city).toBe("");
    expect(m.place).toMatch(/Wyoming|Montana|Idaho/);
  });
});
