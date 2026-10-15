import { defineConfig, devices } from "@playwright/test";

// Browser smoke tests for the production build in ../www (run `ng build
// --configuration production` first, or use `yarn verify` from the app root).
// The API is fully mocked and all other external hosts are blocked, so the
// tests are deterministic and never touch production.
const PORT = 4300;

export default defineConfig({
  testDir: "./specs",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    serviceWorkers: "block", // the app registers ngsw in production builds
    locale: "en-US",
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: {
    command: `node serve.mjs ../www ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: true,
    timeout: 30_000,
  },
});
