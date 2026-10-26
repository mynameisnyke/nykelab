import { expect, test } from "@playwright/test";

const views = async (request: import("@playwright/test").APIRequestContext) => ((await (await request.get("/api/views")).json()) as { views: number }).views;
const send = (request: import("@playwright/test").APIRequestContext, body: object, ua?: string) =>
  request.post("/api/event", { data: body, headers: ua ? { "User-Agent": ua } : {} });
// the count is written after the response, so give it a moment
const settle = () => new Promise((r) => setTimeout(r, 400));

test.describe.configure({ mode: "serial" }); // they share one counter

test.describe("view counter", () => {
  test("a page view adds one; other events, bots and bad events do not", async ({ request }, info) => {
    test.skip(info.project.name !== "desktop", "one shared counter: the desktop and phone projects would race on exact counts");
    const before = await views(request);
    expect(typeof before).toBe("number");

    expect((await send(request, { type: "page_view", path: "/" }, "Mozilla/5.0 (Macintosh) Safari/605")).status()).toBe(204);
    await settle();
    expect(await views(request)).toBe(before + 1);

    await send(request, { type: "media_view", id: "abcdef012345", path: "/x" }, "Mozilla/5.0 (Macintosh) Safari/605");
    await send(request, { type: "page_view", path: "/" }, "Googlebot/2.1");
    await send(request, { type: "page_view", path: "/" }, "Mozilla/5.0 HeadlessChrome/120");
    expect((await send(request, { type: "nonsense", path: "/" }, "Mozilla/5.0 Safari")).status()).toBe(400);
    await settle();
    expect(await views(request)).toBe(before + 1);
  });

  test("the number is shown quietly in the bottom right of the page", async ({ page }) => {
    await page.goto("/about");
    const box = page.locator("#views");
    await expect(box).toHaveClass(/ready/);
    await expect(page.locator("#views-n")).toHaveText(/^\d[\d,]*$/);
    await expect(box).toContainText(/views/i);
    const b = await box.boundingBox();
    const vp = page.viewportSize()!;
    expect(b!.x + b!.width).toBeGreaterThan(vp.width * 0.8); // right side
    expect(b!.y).toBeGreaterThan(vp.height * 0.7); // bottom
    expect(await box.evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none"); // never in the way
  });
});
