import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The click-to-enlarge lightbox on a photo page (scripts/lightbox.ts, components/Lightbox.astro).
const firstTile = (page: import("@playwright/test").Page) => page.locator("section.row img[data-lb]").first();

test("opens on click, steps with the arrow keys, closes on Escape and gives focus back", async ({ page }) => {
  await page.goto("/grand-tetons");
  const tile = firstTile(page);
  await tile.scrollIntoViewIfNeeded();
  const id = await tile.getAttribute("data-id");
  await tile.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`#${id}$`));
  const count = page.locator(".lb-count");
  await expect(count).toHaveText(/^\d+ \/ \d+$/);
  const first = (await count.textContent())!;
  await page.keyboard.press("ArrowRight");
  await expect(count).not.toHaveText(first);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/grand-tetons$/);
  await expect(page.locator("img[data-lb]:focus")).toHaveCount(1);
});

test("a shared link opens that photograph", async ({ page }) => {
  await page.goto("/grand-tetons");
  const id = await firstTile(page).getAttribute("data-id");
  await page.goto(`/grand-tetons#${id}`);
  await page.reload();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".lb-img")).toHaveAttribute("src", new RegExp(`/m/${id}/`));
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toBeHidden();
  await expect(page).toHaveURL(/\/grand-tetons$/);
});

test("the open dialog passes axe", async ({ page }) => {
  await page.goto("/grand-tetons");
  const tile = firstTile(page);
  await tile.scrollIntoViewIfNeeded();
  await tile.click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(800); // the backdrop and the controls fade in
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .exclude("astro-dev-toolbar")
    .exclude(".chapter-nav") // blend-mode text, measured by hand (see a11y.spec.ts)
    .exclude(".views")
    .analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
});

