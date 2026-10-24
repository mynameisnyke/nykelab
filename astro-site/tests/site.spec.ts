import { expect, test, type Page } from "@playwright/test";
import { PAGES, WITH_CHAPTER_NAV } from "./pages";

const errorsOf = (page: Page) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    // "Failed to load resource" carries no URL; the response listener below reports it with one.
    if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(`console: ${m.text()}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  return errors;
};

for (const path of [...PAGES, "/admin"]) {
  test(`loads without errors: ${path}`, async ({ page }) => {
    const errors = errorsOf(page);
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
}

test("unknown routes are real 404s", async ({ request }) => {
  for (const p of ["/nope", "/world", "/places/atlantis", "/years/1999", "/journal/nope"]) {
    expect((await request.get(p)).status(), p).toBe(404);
  }
});

test("every internal link resolves", async ({ page, request }) => {
  test.setTimeout(120_000); // crawls every page, then every place and year link they list
  const seen = new Set<string>();
  for (const path of PAGES) {
    await page.goto(path);
    await page.evaluate(() => document.querySelector<HTMLElement>("[data-menu-open]")?.click());
    await page.waitForTimeout(300); // lets the menu fill its voyages on prerendered pages
    const hrefs = await page.$$eval("a[href]", (as) => as.map((a) => a.getAttribute("href")!));
    hrefs.filter((h) => h.startsWith("/") && !h.startsWith("//")).forEach((h) => seen.add(h.split("#")[0] || "/"));
  }
  const bad: string[] = [];
  for (const h of seen) {
    const s = (await request.get(h, { maxRedirects: 0 })).status();
    if (s >= 400) bad.push(`${h} -> ${s}`);
  }
  expect(bad).toEqual([]);
});

// Catches invisible layers that swallow clicks (the /places bug): the element at the center of
// every link/button must be that element or inside it.
test("nothing blocks a click on any link or button", async ({ page }) => {
  test.setTimeout(120_000);
  for (const path of [...PAGES, "/admin"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    const blocked = await page.evaluate(() => {
      const out: string[] = [];
      const els = [...document.querySelectorAll<HTMLElement>("a[href], button, [role=tab], summary, input, select, textarea")];
      for (const el of els) {
        const cs = getComputedStyle(el);
        const r0 = el.getBoundingClientRect();
        if (!r0.width || !r0.height || cs.visibility === "hidden" || el.closest("[hidden],astro-dev-toolbar,#menu")) continue;
        el.scrollIntoView({ block: "center", inline: "center" });
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (!top || !(el === top || el.contains(top) || top.contains(el))) {
          out.push(`${(el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 30)} blocked by <${top?.tagName.toLowerCase()} class="${(top as HTMLElement)?.className}">`);
        }
      }
      return out;
    });
    // Astro's dev toolbar floats over the bottom-center on phones; ignore it.
    expect(blocked.filter((b) => !b.includes("astro-dev-toolbar")), path).toEqual([]);
  }
});

test.describe("menu", () => {
  for (const path of PAGES) {
    test(`opens, lists the five destinations and closes: ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.locator("header [data-menu-open]").click();
      const menu = page.locator("#menu");
      await expect(menu).toBeVisible();
      await expect(menu.locator(".menu-list a")).toHaveText(["Home", "Places", "Years", "Journal", "About"]);
      await expect(menu.getByRole("link", { name: "Email" })).toHaveAttribute("href", /^mailto:/);
      await expect(menu.getByRole("link", { name: "Instagram" })).toHaveCount(0);
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
    });
  }

  test("voyages group fills on prerendered pages", async ({ page }) => {
    await page.goto("/journal");
    await page.locator("header [data-menu-open]").click();
    await expect(page.locator("#menu .menu-voyages a").first()).toBeVisible();
  });

  for (const path of WITH_CHAPTER_NAV) {
    test(`matches the bottom nav: ${path}`, async ({ page }) => {
      await page.goto(path);
      const bottom = await page.locator(".chapter-nav a").allInnerTexts();
      await page.locator("header [data-menu-open]").click();
      expect(await page.locator("#menu .menu-list a").allInnerTexts()).toEqual(bottom);
    });
  }
});

test("theme toggle switches and persists across a reload", async ({ page }) => {
  await page.goto("/about");
  const html = page.locator("html");
  const before = await html.getAttribute("data-theme");
  await page.locator("header [data-theme-toggle]").click();
  const after = await html.getAttribute("data-theme");
  expect(after).not.toBe(before);
  await page.reload();
  await expect(html).toHaveAttribute("data-theme", after!);
});

test("home: lens tabs, deep links and the clear button", async ({ page }) => {
  await page.goto("/");
  const root = page.locator("main.home");
  await page.getByRole("tab", { name: "When" }).click();
  await expect(root).toHaveAttribute("data-lens", "when");
  await expect(page).toHaveURL(/#when$/);
  await page.getByRole("tab", { name: "How" }).click();
  await expect(root).toHaveAttribute("data-lens", "how");
  // click a bubble -> filter -> Clear
  await page.locator("#chart svg circle").nth(30).click({ force: true });
  await expect(page.locator("#reset")).toBeVisible();
  await page.locator("#reset").click();
  await expect(page.locator("#reset")).toBeHidden();
  await page.goto("/#when");
  await expect(root).toHaveAttribute("data-lens", "when");
});

test("home: stats lines are separate lines and singular/plural reads right", async ({ page }) => {
  await page.goto("/");
  const lines = page.locator("#stats span");
  await expect(lines).toHaveCount(2);
  for (const l of await lines.all()) expect(await l.evaluate((e) => getComputedStyle(e).display)).toBe("block");
  expect(await page.locator("#stats").innerText()).not.toMatch(/\b1 countries/i);
});

test("places: country filter hides cards and dims pins, All restores them", async ({ page }) => {
  await page.goto("/places");
  const cards = page.locator(".card");
  const total = await cards.count();
  await page.getByRole("button", { name: "Iceland" }).click();
  await expect(page.locator(".card:not([hidden])")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Iceland" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "All" }).click();
  await expect(page.locator(".card:not([hidden])")).toHaveCount(total);
});

test("soft navigation keeps scripts alive (places -> about -> back)", async ({ page }) => {
  await page.goto("/");
  await page.locator(".chapter-nav a", { hasText: "Places" }).click();
  await expect(page).toHaveURL(/\/places$/);
  await page.getByRole("button", { name: "Iceland" }).click();
  await expect(page.locator(".card:not([hidden])")).toHaveCount(1);
  await page.locator(".chapter-nav a", { hasText: "About" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await page.locator("header [data-menu-open]").click();
  await expect(page.locator("#menu")).toBeVisible();
});

test("about leads with engineering and keeps the private details off the page", async ({ page }) => {
  await page.goto("/about");
  const text = await page.locator("main").innerText();
  expect(text).toMatch(/engineer/i);
  expect(text).not.toMatch(/\(\d{3}\)\s*\d{3}-\d{4}/); // phone number
  expect(text).not.toMatch(/\$\d+/); // dollar figures
});

test("menu is keyboard-operable: focus moves in, stays in, and returns on Escape", async ({ page, isMobile }) => {
  test.skip(!!isMobile, "keyboard flow is a desktop concern");
  await page.goto("/about");
  const opener = page.locator("header [data-menu-open]");
  await opener.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#menu [data-menu-close]")).toBeFocused();
  for (let i = 0; i < 15; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement?.closest("#menu")), `Tab #${i + 1} left the menu`).toBe(true);
  }
  await page.keyboard.press("Shift+Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("#menu"))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#menu")).toBeHidden();
  await expect(opener).toBeFocused();
});
