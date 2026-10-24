import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { PAGES } from "./pages";

// WCAG 2.1 A/AA automated checks in both themes. Automated checks catch roughly a third of
// accessibility problems (contrast, names, roles, landmarks); they do not replace a manual pass.
for (const theme of ["dark", "light"]) {
  for (const path of PAGES) {
    test(`axe (${theme}): ${path}`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem("theme", t), theme);
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      // Contrast must be measured at rest, not mid fade-in (reveal transitions, the globe intro).
      await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== "running"), null, { timeout: 15_000 });
      await page.waitForTimeout(500);
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
        .exclude("astro-dev-toolbar")
        // The bottom nav is white with mix-blend-mode: difference so it reads over any photo. axe cannot
        // model blend modes and reports white-on-cream. Real contrast by hand, light theme: text
        // = 0.7 * |cream - white| + 0.3 * cream, about #4F5158 on #FAF3E1, roughly 7:1 inactive.
        .exclude(".chapter-nav")
        .analyze();
      const summary = violations.map((v) => `${v.id} (${v.impact}) x${v.nodes.length}: ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      expect(summary).toEqual([]);
    });
  }
}

test("menu overlay is accessible when open", async ({ page }) => {
  await page.goto("/places");
  await page.locator("header [data-menu-open]").click();
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).exclude("astro-dev-toolbar").analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
});
