import { expect, test } from "@playwright/test";
import { pickHero, type HeroCandidate } from "../src/lib/hero";

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
