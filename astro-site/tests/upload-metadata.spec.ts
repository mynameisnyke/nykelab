import { expect, test, type APIRequestContext } from "@playwright/test";
import fs from "node:fs";
import { execSync } from "node:child_process";

// Uploads the fixture photos through the same admin API calls the browser makes and checks what is stored.
// Runs against the dev server (admin login is skipped there). The local D1 must have the newest migration.
test.beforeAll(() => {
  execSync("npx wrangler d1 migrations apply DB --local --persist-to .wrangler/state", { stdio: "ignore" });
});
test.describe.configure({ mode: "serial" });

const hex = () => [...crypto.getRandomValues(new Uint8Array(6))].map((b) => b.toString(16).padStart(2, "0")).join("");

async function upload(request: APIRequestContext, collection: string, fixture: string, extra: Record<string, unknown> = {}) {
  const bytes = fs.readFileSync(`tests/fixtures/${fixture}.jpg`);
  const id = hex();
  const init = await (await request.post("/api/admin/uploads", { data: { id, contentType: "image/jpeg", size: bytes.length } })).json();
  const part = await (
    await request.put(`/api/admin/uploads/${id}/parts/1?key=${encodeURIComponent(init.key)}&uploadId=${init.uploadId}`, { data: bytes, headers: { "Content-Type": "application/octet-stream" } })
  ).json();
  await request.post(`/api/admin/uploads/${id}/complete?key=${encodeURIComponent(init.key)}`, { data: { uploadId: init.uploadId, parts: [part] } });
  const res = await request.post("/api/admin/media", { data: { id, collection, type: "image", width: 96, height: 64, orientation: "landscape", keys: { original: init.key }, ...extra } });
  expect(res.status()).toBe(201);
  return (await res.json()).media;
}

let slug = "";
const made: string[] = [];

test.beforeAll(async ({ request }) => {
  const title = `Meta test ${hex()}`;
  const res = await request.post("/api/admin/collections", { data: { title } });
  slug = (await res.json()).slug;
});
test.afterAll(async ({ request }) => {
  for (const id of made) await request.delete(`/api/admin/media/${id}`);
  await request.delete(`/api/admin/collections/${slug}`);
});

test("a photo with GPS and a caption arrives with place, caption and camera filled in", async ({ request }) => {
  const m = await upload(request, slug, "gps");
  made.push(m.id);
  expect(m.caption).toBe("Dusk over the valley from the balcony");
  expect(m.captionSource).toBe("photo");
  expect(m.city).toBe("Medellín");
  expect(m.country).toBe("Colombia");
  expect(m.place).toMatch(/^Medellín, .*Colombia$/);
  expect(m.placeSource).toBe("gps");
  expect(m.capturedAt).toBe("2020-01-30T05:56:22");
  expect(m.camera).toBe("SONY ILCE-7M3");
  expect([m.focal, m.aperture, m.iso, m.shutter]).toEqual([85, 1.8, 400, "1/250"]);
  expect(m.hasGps).toBe(true);
});

test("the exact GPS fix is never in any API response, admin or public", async ({ request }) => {
  const admin = JSON.stringify(await (await request.get(`/api/admin/media?collection=${slug}`)).json());
  const pub = JSON.stringify(await (await request.get(`/api/media?collection=${slug}`)).json());
  for (const body of [admin, pub]) {
    expect(body).not.toMatch(/gps_?lat|gps_?lon|gpsLat|gpsLon/i);
    expect(body).not.toContain("6.23417"); // the fixture's exact fix
    expect(body).not.toContain("75.56943");
  }
  expect(pub).toContain("Medellín");
});

test("Lightroom place text is used when there is no GPS", async ({ request }) => {
  const m = await upload(request, slug, "iptc");
  made.push(m.id);
  expect(m.place).toBe("Tarrytown, New York, United States");
  expect(m.placeSource).toBe("tags");
  expect(m.caption).toBe("Afghan hound, best of breed");
  expect(m.hasGps).toBe(false);
});

test("a photo with no metadata is stored with blanks, not an error", async ({ request }) => {
  const m = await upload(request, slug, "bare");
  made.push(m.id);
  expect([m.caption, m.place, m.camera, m.placeSource, m.captionSource]).toEqual(["", "", "", "", ""]);
  expect(m.capturedAt).toBeNull();
});

test("what you type at upload wins over the photo", async ({ request }) => {
  const m = await upload(request, slug, "gps", { caption: "My own caption", place: "Home balcony" });
  made.push(m.id);
  expect([m.caption, m.place, m.captionSource, m.placeSource]).toEqual(["My own caption", "Home balcony", "manual", "manual"]);
  expect(m.city).toBe("Medellín"); // the photo's own data is still recorded
});

test("re-reading refreshes auto values but never replaces something typed (unless asked)", async ({ request }) => {
  const m = await upload(request, slug, "gps");
  made.push(m.id);
  await request.patch(`/api/admin/media/${m.id}`, { data: { place: "Typed place" } });
  let r = (await (await request.post(`/api/admin/media/${m.id}/read-metadata`, { data: {} })).json()).media;
  expect(r.place).toBe("Typed place");
  expect(r.placeSource).toBe("manual");
  r = (await (await request.post(`/api/admin/media/${m.id}/read-metadata`, { data: { overwrite: true } })).json()).media;
  expect(r.place).toMatch(/^Medellín/);
  expect(r.placeSource).toBe("gps");
});

test("editing a caption by hand marks it manual; clearing it hands it back to the photo", async ({ request }) => {
  const m = await upload(request, slug, "gps");
  made.push(m.id);
  let r = (await (await request.patch(`/api/admin/media/${m.id}`, { data: { caption: "Edited" } })).json()).media;
  expect([r.caption, r.captionSource]).toEqual(["Edited", "manual"]);
  r = (await (await request.patch(`/api/admin/media/${m.id}`, { data: { caption: "" } })).json()).media;
  expect(r.captionSource).toBe("");
  r = (await (await request.post(`/api/admin/media/${m.id}/read-metadata`, { data: {} })).json()).media;
  expect([r.caption, r.captionSource]).toEqual(["Dusk over the valley from the balcony", "photo"]);
});

test("admin screen: dropping a photo shows its place, caption and camera without typing anything", async ({ page, request, isMobile }) => {
  test.skip(!!isMobile, "admin is a desktop screen");
  const title = `UI meta ${hex()}`;
  const col = (await (await request.post("/api/admin/collections", { data: { title } })).json()).slug;
  try {
    await page.goto("/admin");
    await page.getByRole("button", { name: new RegExp(`^${title}`) }).click(); // show only this collection
    await page.locator("select.field").first().selectOption(col);
    await page.locator('input[type="file"]').setInputFiles("tests/fixtures/gps.jpg");
    const card = page.locator("li", { has: page.locator("textarea") }).first();
    await expect(card.locator("textarea")).toHaveValue("Dusk over the valley from the balcony", { timeout: 20_000 });
    await expect(card.locator('input[placeholder^="Place"]')).toHaveValue(/^Medellín, .*Colombia$/);
    await expect(card).toContainText("Place from the photo's GPS");
    await expect(card).toContainText("SONY ILCE-7M3");
    await expect(card).toContainText("85mm");
    await page.screenshot({ path: "test-results/admin-autofill.png" });
    // typed values stay, and the label follows
    await card.locator('input[placeholder^="Place"]').fill("Our balcony");
    await card.locator('input[placeholder^="Place"]').blur();
    await expect(card).toContainText("Place typed by you");
  } finally {
    const media = (await (await request.get(`/api/admin/media?collection=${col}`)).json()).media as { id: string }[];
    for (const m of media) await request.delete(`/api/admin/media/${m.id}`);
    await request.delete(`/api/admin/collections/${col}`);
  }
});
