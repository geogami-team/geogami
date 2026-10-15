import { test, expect, appReady } from "../fixtures";

// Checks that the test harness itself still catches what it is meant to catch.
test.describe("harness", () => {
  test("a missing local asset is reported, not swallowed", async ({ page, consoleErrors }) => {
    await page.goto("/");
    await appReady(page);
    await page.evaluate(() => {
      const img = document.createElement("img");
      img.src = "/assets/this-file-does-not-exist.png";
      document.body.appendChild(img);
    });
    await expect.poll(() => consoleErrors.join("\n")).toContain("local asset 404: http://127.0.0.1:4300/assets/this-file-does-not-exist.png");
    expect(consoleErrors.some((e) => e.startsWith("console.error: Failed to load resource"))).toBe(true);
    consoleErrors.length = 0; // expected here; the fixture would otherwise fail the test
  });

  test("requests to blocked external hosts are not reported", async ({ page, api, consoleErrors }) => {
    await page.goto("/");
    await appReady(page);
    expect(api.blocked.size).toBeGreaterThan(0); // e.g. the mapbox CDN script and Google Fonts
    expect(consoleErrors).toEqual([]);
  });
});
