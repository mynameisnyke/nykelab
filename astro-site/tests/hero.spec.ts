import { expect, test } from "@playwright/test";
import { applyPicks, pickHero, type HeroCandidate } from "../src/lib/hero";

const still = (orientation: HeroCandidate["orientation"], heroOk: boolean): HeroCandidate => ({ type: "image", orientation, heroOk });
const clip = (orientation: HeroCandidate["orientation"] = "landscape"): HeroCandidate => ({ type: "video", orientation, heroOk: true });

test.describe("what may be a hero", () => {
  test("a landscape clip comes first, whatever the stills are", () => {
    expect(pickHero([still("landscape", true), clip(), still("landscape", true)])).toEqual({ index: 1, soft: false });
  });
  test("without a clip, the first landscape still that is sharp enough, skipping soft ones", () => {
    expect(pickHero([still("landscape", false), still("portrait", true), still("landscape", true)])).toEqual({ index: 2, soft: false });
  });
  test("a vertical clip is never a hero", () => {
    expect(pickHero([clip("portrait"), still("landscape", true)])).toEqual({ index: 1, soft: false });
  });
  test("when nothing is sharp enough the first landscape still is used and flagged soft", () => {
    expect(pickHero([still("portrait", true), still("landscape", false), still("landscape", false)])).toEqual({ index: 1, soft: true });
  });
  test("nothing wide at all: the first item, flagged soft only if it is a still we chose", () => {
    expect(pickHero([still("portrait", true)])).toEqual({ index: 0, soft: false });
    expect(pickHero([])).toEqual({ index: 0, soft: false });
  });
});

const item = (id: string, base: HeroCandidate) => ({ id, ...base });

test.describe("hand-picked hero and next item", () => {
  const media = [item("a", still("landscape", true)), item("b", still("portrait", true)), item("c", clip("portrait")), item("d", still("landscape", false))];
  test("the pick wins over the automatic hero, even a portrait still, and the next one is set aside", () => {
    expect(applyPicks(media, { hero: "b", next: "c" })).toEqual({ hero: 1, heroPicked: true, next: 2 });
  });
  test("without picks it is the automatic hero and no next", () => {
    expect(applyPicks(media)).toEqual({ hero: 0, heroPicked: false, next: -1 });
  });
  test("a pick that is not in the collection is ignored", () => {
    expect(applyPicks(media, { hero: "zzz", next: "nope" })).toEqual({ hero: 0, heroPicked: false, next: -1 });
  });
  test("the hero is never also the next item", () => {
    expect(applyPicks(media, { hero: "b", next: "b" }).next).toBe(-1);
  });
});

test("the Colorado page opens on the picked hero, then the picked clip alone and centred", async ({ page }) => {
  await page.goto("/colorado");
  const hero = page.locator("section.hero img, section.hero video").first();
  test.skip(!(await hero.count()), "no Colorado collection in this database");
  const src = (await hero.getAttribute("src")) ?? (await hero.getAttribute("data-src")) ?? "";
  test.skip(!/c9a71bb4d7f7/.test(src) && !(await page.locator("img[data-id='c9a71bb4d7f7']").count()), "the picked photograph is not in this database");
  await expect(page.locator("section.hero [data-id='c9a71bb4d7f7']")).toHaveCount(1);
  // the next item is a row of one (so centred), when the clip exists here
  if (await page.locator("[data-id='4c3cdbac50c7']").count()) {
    const firstBlock = page.locator("main > section").nth(1); // 0 is the hero
    await expect(firstBlock).toHaveClass(/n1/);
    await expect(firstBlock.locator("[data-id='4c3cdbac50c7']")).toHaveCount(1);
  }
});
