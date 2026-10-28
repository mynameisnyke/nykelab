import { expect, test } from "@playwright/test";

// Mini DV: a walk along the desk, then the drawer of tapes and the Sony deck. Runs against the dev server, which streams
// the captures from the Mini DV folder (MINIDV_DIR, default ~/mini dv); the playback tests skip themselves when that folder is not there.
const TAPE = "oaxaca-p2"; // the shortest tape, 10:28

/** the list starts folded away, so the desk is what you see */
async function chooseTape(page: import("@playwright/test").Page, id: string) {
  if (await page.locator("#md-shelf.collapsed").count()) await page.locator("#md-shelf-toggle").click();
  await page.locator(`#md-list button[data-tape='${id}']`).click();
}

test.describe("Mini DV", () => {
  test("it is in the bottom nav and the menu as the tape mark", async ({ page }) => {
    await page.goto("/about");
    const bottom = page.locator("nav.chapter-nav a[href='/mini-dv']");
    await expect(bottom).toHaveAttribute("aria-label", "Mini DV");
    await expect(bottom.locator("svg")).toBeVisible();
    await page.locator("[data-menu-open]").click();
    const row = page.locator("#menu a[href='/mini-dv']");
    await expect(row).toHaveAttribute("aria-label", "Mini DV");
    await expect(row.locator("svg")).toBeVisible();
  });

  test("every tape is listed by name, each with its running time", async ({ page }) => {
    await page.goto("/mini-dv");
    await page.locator("#md-shelf-toggle").click();
    const tapes = page.locator("#md-list button[data-tape]");
    await expect(tapes).toHaveCount(14);
    await expect(tapes.filter({ hasText: "Oaxaca P2" })).toContainText("10:28");
    await expect(tapes.filter({ hasText: "Summer 26" })).toHaveCount(1);
    // the duplicate "compressed for LINE" copy of winter-spring-2026 is not a tape of its own
    await expect(page.locator("#md-list")).not.toContainText("LINE");
  });

  test("the desk is on the canvas, and scrolling walks the camera along the desk with captions", async ({ page }) => {
    await page.goto("/mini-dv");
    const canvas = page.locator("canvas.md-canvas");
    await expect(canvas).toBeVisible();
    await expect(page.locator(".md-cap[data-stop='0']")).toHaveAttribute("data-on", "");
    await page.waitForTimeout(2500); // the textures load and the first frames draw
    const first = await canvas.screenshot();
    expect(first.length).toBeGreaterThan(60_000); // a flat colour would compress to almost nothing

    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await expect(page.locator(".md-cap[data-stop='5']")).toHaveAttribute("data-on", "");
    await expect(page.locator(".md-cap[data-stop='0']")).not.toHaveAttribute("data-on", "");
    await page.waitForTimeout(3000); // the camera glides there
    const last = await canvas.screenshot();
    expect(Buffer.compare(first, last)).not.toBe(0); // the view moved
    await expect(page.locator("#md-hint")).toBeVisible(); // "pull the drawer"
  });

  test("choosing a tape takes it out of its case, into the deck, and plays it", async ({ page, request }) => {
    test.setTimeout(150_000);
    const probe = await request.get("/minidv-local/OAXACA%20P2.mp4", { headers: { Range: "bytes=0-1023" } });
    test.skip(probe.status() === 404, "no Mini DV folder on this machine");
    expect(probe.status()).toBe(206);
    expect(probe.headers()["content-range"]).toMatch(/^bytes 0-1023\//);

    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/mini-dv");
    await expect(page.locator("canvas.md-canvas")).toBeVisible();

    await chooseTape(page, TAPE);
    await expect(page.locator("#md-status")).toContainText("Loading Oaxaca P2");
    await expect(page.locator("html")).toHaveClass(/md-locked/); // the camera is directed, the page does not scroll
    const hud = page.locator("#md-hud.open");
    await expect(hud).toBeVisible({ timeout: 90_000 });
    await expect(page.locator("#md-now")).toHaveText("Oaxaca P2");
    await expect(page.locator(`#md-list button[data-tape='${TAPE}']`)).toHaveAttribute("aria-current", "true");

    // the deck is really playing: the counter moves
    await expect(page.locator("#md-hud")).toHaveAttribute("data-state", "playing", { timeout: 30_000 });
    await expect.poll(async () => (await page.locator("#md-time").textContent()) ?? "", { timeout: 30_000 }).not.toMatch(/^0:00 \//);

    // the controls work
    await page.locator("[data-act='play']").click(); // play/pause
    await expect(hud).toHaveAttribute("data-state", "paused");
    await page.locator("[data-act='play']").click();
    await expect(hud).toHaveAttribute("data-state", "playing");
    await page.locator("[data-act='stop']").click();
    await expect(hud).toHaveAttribute("data-state", "stopped");

    // back to the desk: the camera is the scroll's again, and the tape stays in the deck
    await page.locator("#md-hud [data-hud-close]").click();
    await expect(page.locator("#md-hud")).toBeHidden();
    await expect(page.locator("html")).not.toHaveClass(/md-locked/, { timeout: 30_000 });
    await expect(page.locator(`#md-list button[data-tape='${TAPE}']`)).toHaveAttribute("aria-current", "true");

    // eject: it goes back into its case in the drawer
    await page.evaluate(() => (window as unknown as { __md: { eject: () => Promise<void> } }).__md.eject());
    await expect(page.locator("#md-list [aria-current]")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.locator("#md-status")).toContainText("is back in the drawer", { timeout: 90_000 });
    expect(errors).toEqual([]);
  });

  test("Escape hands the camera back and leaves the tape playing", async ({ page, request }) => {
    test.setTimeout(150_000);
    const probe = await request.head("/minidv-local/OAXACA%20P2.mp4");
    test.skip(probe.status() === 404, "no Mini DV folder on this machine");
    await page.goto("/mini-dv");
    await chooseTape(page, TAPE);
    await expect(page.locator("#md-hud")).toHaveAttribute("data-state", "playing", { timeout: 90_000 });
    await page.keyboard.press("Escape");
    await expect(page.locator("#md-hud")).toBeHidden();
    await expect(page.locator("#md-status")).toContainText("Playing Oaxaca P2");
  });
});
