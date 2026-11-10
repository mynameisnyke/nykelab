import { test, expect, type APIRequestContext } from "@playwright/test";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// What /m hands out: every image is WebP, and only the current file of a photograph is kept.
// Request-level checks, so one project is enough (two would race on the same stored files).
test.beforeEach(({ isMobile }) => test.skip(!!isMobile, "storage checks run once, on desktop"));

type Item = { id: string; type: string; urls: { main: string; small?: string; poster?: string; variants?: { width: number; url: string }[] } };

async function everything(request: APIRequestContext): Promise<Item[]> {
  const { collections } = await (await request.get("/api/collections")).json();
  const out: Item[] = [];
  for (const c of collections) out.push(...(await (await request.get(`/api/media?collection=${c.slug}`)).json()).media);
  return out;
}
const r2 = (...args: string[]) => execFileSync("npx", ["wrangler", "r2", "object", ...args, "--local", "--persist-to", ".wrangler/state"], { stdio: "pipe" });

test("no image address the API hands out is a JPEG or a PNG", async ({ request }) => {
  const media = await everything(request);
  test.skip(!media.length, "empty database (npm run seed)");
  const urls = media.flatMap((m) => [m.type === "image" ? m.urls.main : null, m.urls.small, m.urls.poster, ...(m.urls.variants ?? []).map((v) => v.url)]).filter((u): u is string => !!u);
  expect(urls.length).toBeGreaterThan(0);
  for (const u of urls) expect(u).toMatch(/\.webp(\?r=\d+)?$/);
});

test("a JPEG in storage (an older photograph, a poster) is served as a WebP copy", async ({ request }) => {
  const media = await everything(request);
  const m = media.find((x) => x.type === "image" && !x.urls.variants) ?? media.find((x) => x.urls.poster);
  test.skip(!m, "no stored JPEG in this database (npm run seed adds one)");
  const url = m!.urls.poster ?? m!.urls.main;
  const first = await request.get(url);
  expect(first.status()).toBe(200);
  expect(first.headers()["content-type"]).toBe("image/webp");
  expect((await first.body()).subarray(8, 12).toString()).toBe("WEBP");
  expect(first.headers()["cache-control"]).toContain("immutable");
  // made once, then served from storage: the stored copy answers with an ETag and a 304 to a browser that has it
  let etag = "";
  await expect.poll(async () => (etag = (await request.get(url)).headers()["etag"] ?? "")).not.toBe("");
  expect((await request.get(url, { headers: { "If-None-Match": etag } })).status()).toBe(304);
});

test("an address with an old rev goes to the current file, and old sized copies are dropped", async ({ request }) => {
  const media = await everything(request);
  const m = media.find((x) => x.type === "image" && x.urls.variants?.length);
  test.skip(!m, "no photograph with an original in this database (npm run seed)");
  const current = m!.urls.variants![0].url; // /m/<id>/w480.webp[?r=N]
  const [file, r] = current.split("?r=");
  const rev = Number(r ?? 1);
  const key = (n: number) => `nykelab-media/${m!.id}/w480${n > 1 ? `-r${n}` : ""}.webp`;
  const made = await request.get(current);
  expect(made.status()).toBe(200);
  expect(made.headers()["content-type"]).toBe("image/webp");

  // an address from before the file was replaced: nothing is made under the old name, the browser is sent to the current one
  const old = await request.get(`${file}?r=${rev + 50}`, { maxRedirects: 0 });
  expect(old.status()).toBe(302);
  expect(old.headers()["location"]).toBe(current);

  // a sized copy left over from an earlier file (put there by hand) is removed the next time the current one is made
  const tmp = path.join(os.tmpdir(), `nykelab-stale-${m!.id}.webp`);
  fs.writeFileSync(tmp, await made.body());
  try {
    r2("put", key(rev + 50), "--file", tmp, "--content-type", "image/webp");
    expect((await request.get(`${file}?r=${rev + 50}`, { maxRedirects: 0 })).status()).toBe(200); // it is there
    r2("delete", key(rev));
    expect((await request.get(current)).status()).toBe(200); // made again
    await expect.poll(async () => (await request.get(`${file}?r=${rev + 50}`, { maxRedirects: 0 })).status(), { timeout: 15_000 }).toBe(302);
  } finally {
    fs.rmSync(tmp, { force: true });
  }
});

test("the Azure page's poster frame is WebP too", async ({ request }) => {
  const r = await request.get("/m/azure/background.webp");
  test.skip(r.status() === 404, "azure media not in local storage (node scripts/publish-azure.mjs)");
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toBe("image/webp");
  expect(r.headers()["cache-control"]).toBe("public, max-age=86400"); // fixed name, replaceable: a day, not forever
});
