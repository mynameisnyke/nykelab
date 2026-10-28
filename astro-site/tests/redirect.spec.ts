import { expect, test } from "@playwright/test";
import { wwwRedirect } from "../worker/src/redirect";

test("www goes to the bare domain, keeping path and query; everything else is left alone", () => {
  expect(wwwRedirect("https://www.nykelab.nyc/")).toBe("https://nykelab.nyc/");
  expect(wwwRedirect("https://www.nykelab.nyc/oaxaca?x=1#top")).toBe("https://nykelab.nyc/oaxaca?x=1");
  expect(wwwRedirect("https://nykelab.nyc/oaxaca")).toBeNull();
  expect(wwwRedirect("https://nykelab-astro.nykelab-astro.workers.dev/")).toBeNull();
  expect(wwwRedirect("http://localhost:4322/about")).toBeNull();
});
