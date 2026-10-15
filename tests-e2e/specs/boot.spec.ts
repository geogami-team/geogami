import { test, expect, appReady } from "../fixtures";

test("the app boots and shows the start page", async ({ page }) => {
  await page.goto("/");
  await appReady(page);
  await expect(page.locator("ion-app")).toBeVisible();
});
