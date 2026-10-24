import { defineConfig } from "@playwright/test";

// Runs against the dev server (npm run dev, port 4322) using the installed Chrome, so no browser
// download is needed. If the server is not running, Playwright starts it.
export default defineConfig({
  testDir: "tests",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4322", channel: "chrome" },
  webServer: { command: "npm run dev", url: "http://localhost:4322", reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: "desktop", use: { viewport: { width: 1440, height: 900 } } },
    { name: "phone", use: { viewport: { width: 375, height: 812 }, hasTouch: true, isMobile: true } },
  ],
});
