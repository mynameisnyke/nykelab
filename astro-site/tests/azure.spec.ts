import { expect, test } from "@playwright/test";

// Infinite Azure: the endless photograph scroll. Needs published photographs with originals in the local database
// (the library loader or a few uploads); the tests that need them skip themselves when there are none.
const feedSize = async (page: import("@playwright/test").Page) => page.evaluate(() => JSON.parse(document.getElementById("az-data")?.textContent ?? "[]").length as number);

test.describe("Infinite Azure", () => {
  test("it is in the bottom nav and the menu as the infinity mark", async ({ page }) => {
    await page.goto("/about");
    const bottom = page.locator("nav.chapter-nav a[href='/infinite-azure']");
    await expect(bottom).toHaveAttribute("aria-label", "Infinite Azure");
    await expect(bottom.locator("svg")).toBeVisible();
    await page.locator("[data-menu-open]").click();
    const row = page.locator("#menu a[href='/infinite-azure']");
    await expect(row).toHaveAttribute("aria-label", "Infinite Azure");
    await expect(row.locator("svg")).toBeVisible();
  });

  test("the page asks first, then scrolls on without end", async ({ page }) => {
    await page.goto("/infinite-azure");
    test.skip((await feedSize(page)) < 6, "no photographs with originals in this database");
    await expect(page.locator("#az-intro")).toBeVisible();
    await expect(page.locator("#az-bg")).toHaveAttribute("src", "/m/azure/background.mp4");
    await expect(page.locator(".az-piece")).toHaveCount(0); // nothing is built before Enter
    await page.locator("#az-silent").click();
    await expect(page.locator("#az-intro")).toBeHidden();
    await expect(page.locator(".az-piece").first()).toBeVisible();
    const before = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 1400);
      await page.waitForTimeout(150);
    }
    const after = await page.evaluate(() => document.documentElement.scrollHeight);
    expect(after).toBeGreaterThan(before + 3000); // scenes keep arriving
    // far-away scenes are emptied so the page stays light
    expect(await page.locator(".az-piece").count()).toBeLessThan(40);
  });

  test("sound starts only when asked for", async ({ page }) => {
    await page.goto("/infinite-azure");
    test.skip((await feedSize(page)) < 6, "no photographs with originals in this database");
    await page.locator("#az-silent").click();
    expect(await page.evaluate(() => (document.getElementById("az-audio") as HTMLAudioElement).paused)).toBe(true);
    await page.locator("#az-sound").click(); // the speaker button turns it on
    await expect.poll(() => page.evaluate(() => (document.getElementById("az-audio") as HTMLAudioElement).paused)).toBe(false);
    await expect(page.locator("#az-sound")).toHaveAttribute("aria-pressed", "true");
    await page.locator("#az-sound").click();
    await expect.poll(() => page.evaluate(() => (document.getElementById("az-audio") as HTMLAudioElement).paused)).toBe(true);
  });

  test("a photograph landing fires the hit flash", async ({ page }) => {
    await page.goto("/infinite-azure");
    test.skip((await feedSize(page)) < 6, "no photographs with originals in this database");
    await page.locator("#az-silent").click();
    await page.waitForTimeout(400);
    // let the first arrivals settle, then scroll a new photograph in and look for lit pixels on the effects canvas
    await page.waitForTimeout(2200);
    await page.mouse.wheel(0, 1600);
    let lit = false;
    for (let i = 0; i < 14 && !lit; i++) {
      await page.waitForTimeout(40);
      lit = await page.evaluate(() => {
        const c = document.getElementById("az-hit") as HTMLCanvasElement;
        const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
        for (let k = 3; k < d.length; k += 4 * 97) if (d[k] > 40) return true;
        return false;
      });
    }
    expect(lit).toBe(true);
    await expect(page.locator(".az-piece.landed").first()).toBeAttached();
  });

  test("the combo counter goes up by one for every photograph that lands, then fades but keeps its count", async ({ page }) => {
    await page.goto("/infinite-azure");
    test.skip((await feedSize(page)) < 6, "no photographs with originals in this database");
    await expect(page.locator("#az-combo")).not.toHaveClass(/on/);
    await page.locator("#az-silent").click();
    await expect(page.locator("#az-combo")).toHaveClass(/on/);
    for (let i = 0; i < 4; i++) {
      await page.mouse.wheel(0, 1200);
      await page.waitForTimeout(250);
    }
    const state = await page.evaluate(() => ({ n: Number(document.getElementById("az-combo-n")!.textContent), landed: document.querySelectorAll(".az-piece.landed").length }));
    expect(state.n).toBeGreaterThanOrEqual(state.landed); // pieces emptied far above no longer count as landed, but their hits stay counted
    expect(state.n).toBeGreaterThan(3);
    expect(await page.locator("#az-combo .label").textContent()).toBe("Hit Combo");
    await expect(page.locator("#az-combo")).not.toHaveClass(/on/, { timeout: 6000 }); // idle: it slides away
    const settled = Number(await page.locator("#az-combo-n").textContent()); // and keeps its count
    expect(settled).toBeGreaterThanOrEqual(state.n);
    await page.waitForTimeout(600);
    expect(Number(await page.locator("#az-combo-n").textContent())).toBe(settled);
  });

  test("each landing plays a hit sound, but only while the sound is on", async ({ page }) => {
    // count every sound the page starts through Web Audio
    await page.addInitScript(() => {
      (window as unknown as { __hitSounds: number }).__hitSounds = 0;
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        (window as unknown as { __hitSounds: number }).__hitSounds++;
        return start.apply(this, args);
      };
    });
    const count = () => page.evaluate(() => (window as unknown as { __hitSounds: number }).__hitSounds);
    const scrollSome = async () => {
      for (let i = 0; i < 4; i++) {
        await page.mouse.wheel(0, 1300);
        await page.waitForTimeout(260);
      }
      await page.waitForTimeout(500);
    };
    await page.goto("/infinite-azure");
    test.skip((await feedSize(page)) < 6, "no photographs with originals in this database");
    await page.locator("#az-silent").click(); // in without sound: the flashes fire, the sounds do not
    await scrollSome();
    expect(await count()).toBe(0);

    await page.locator("#az-sound").click(); // sound on
    await page.waitForTimeout(1500); // the six clips decode
    await scrollSome();
    const playing = await count();
    expect(playing).toBeGreaterThan(0);

    await page.locator("#az-sound").click(); // muted again
    await expect(page.locator("#az-sound")).toHaveAttribute("aria-pressed", "false");
    await scrollSome();
    expect(await count()).toBe(playing);
  });

  test("with reduced motion: no drift, no flash, the loop stays on its first frame", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/infinite-azure");
    test.skip((await feedSize(page)) < 6, "no photographs with originals in this database");
    await page.locator("#az-silent").click();
    await page.mouse.wheel(0, 900);
    await page.waitForTimeout(700);
    expect(await page.evaluate(() => (document.getElementById("az-bg") as HTMLVideoElement).paused)).toBe(true);
    const drift = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>(".az-piece")].map((e) => /translate3d\(0px, 0px, 0px\)/.test(e.style.transform)));
    expect(drift.length).toBeGreaterThan(0);
    expect(drift.every(Boolean)).toBe(true);
    const lit = await page.evaluate(() => {
      const c = document.getElementById("az-hit") as HTMLCanvasElement;
      const d = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data;
      return d.some((v, i) => i % 4 === 3 && v > 0);
    });
    expect(lit).toBe(false);
    await ctx.close();
  });

  test("the azure media is served with range support", async ({ request }) => {
    const r = await request.get("/m/azure/background.mp4", { headers: { Range: "bytes=0-99" } });
    test.skip(r.status() === 404, "azure media not in local storage (node scripts/publish-azure.mjs)");
    expect(r.status()).toBe(206);
    expect(r.headers()["content-type"]).toBe("video/mp4");
    expect(r.headers()["content-range"]).toMatch(/^bytes 0-99\//);
    const hit = await request.get("/m/azure/hit-1.wav");
    expect(hit.status()).toBe(200);
    expect(hit.headers()["content-type"]).toBe("audio/wav");
    expect((await request.get("/m/azure/hit-7.wav")).status()).toBe(404);
    expect((await request.get("/m/azure/nope.mp4")).status()).toBe(404);
    expect((await request.get("/m/azure/../x.mp4")).status()).toBe(404);
  });
});
