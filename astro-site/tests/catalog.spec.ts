import { expect, test } from "@playwright/test";
import fs from "node:fs";

// Invariants of the generated catalog (src/data/catalog.json, built from the Lightroom CSV by `npm run catalog`).
const catalog = JSON.parse(fs.readFileSync("src/data/catalog.json", "utf8")) as {
  voyages: { id: string; title: string; kind: string; start: number; end: number; count: number; lat: number; lon: number; slug: string }[];
  lenses: string[];
  shots: [number, number, number, number, number, number, number, string, number][];
};

// Loops collect violations and assert once: thousands of individual expect() calls are very slow.
test("every shot belongs to a voyage and the counts add up", () => {
  const counts = new Array(catalog.voyages.length).fill(0);
  const bad: string[] = [];
  for (const s of catalog.shots) {
    if (!(s[0] >= 0 && s[0] < catalog.voyages.length)) bad.push(`voyage index ${s[0]}`);
    else counts[s[0]]++;
  }
  expect(bad).toEqual([]);
  expect(counts).toEqual(catalog.voyages.map((v) => v.count));
});

test("voyages are in date order, with sane places and dates", () => {
  const starts = catalog.voyages.map((v) => v.start);
  expect(starts).toEqual([...starts].sort((a, b) => a - b));
  const bad: string[] = [];
  for (const v of catalog.voyages) {
    if (v.end < v.start) bad.push(`${v.title}: ends before it starts`);
    if (Math.abs(v.lat) > 90 || Math.abs(v.lon) > 180) bad.push(`${v.title}: impossible coordinates`);
    if (!["trip", "home", "event"].includes(v.kind)) bad.push(`${v.title}: kind ${v.kind}`);
  }
  expect(bad).toEqual([]);
  expect(new Set(catalog.voyages.map((v) => v.id)).size).toBe(catalog.voyages.length);
});

test("every photograph is dated inside its voyage (except the open-ended home voyage)", () => {
  const DAY = 86400000;
  const bad = new Set<string>();
  for (const s of catalog.shots) {
    const v = catalog.voyages[s[0]];
    const t = s[1] * 60000;
    if (v.kind !== "home" && (t < v.start - 3 * DAY || t > v.end + 4 * DAY)) bad.add(`${v.title}: ${new Date(t).toISOString()}`);
  }
  expect([...bad]).toEqual([]);
});

test("hours are in range and camera settings are bucketed", () => {
  let bad = 0;
  for (const s of catalog.shots) {
    if (!(s[2] >= 0 && s[2] < 2400 && s[3] >= 0 && s[3] < 2400 && s[4] > 0 && s[5] > 0 && s[8] < catalog.lenses.length)) bad++;
  }
  expect(bad).toBe(0);
  expect(new Set(catalog.shots.map((s) => s[5])).size).toBeLessThanOrEqual(14); // f-stops, not raw values
});

test("events are kept off the places map but stay on the home list", async ({ request }) => {
  const events = catalog.voyages.filter((v) => v.kind === "event");
  expect(events.map((v) => v.title)).toEqual(expect.arrayContaining(["Westminster 2020", "Westminster 2021", "NYCC 2021", "NYCC 2022"]));
  // the page's own content: the menu (outside <main>) lists every voyage, events included
  const places = ((await (await request.get("/places")).text()).match(/<main[\s\S]*<\/main>/) ?? [""])[0];
  const home = await (await request.get("/")).text();
  for (const e of events) {
    expect(places).not.toContain(`>${e.title}<`);
    expect(home).toContain(e.title);
  }
});
