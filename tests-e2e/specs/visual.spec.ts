import { test, expect, appReady, signIn, user, game, list } from "../fixtures";

// Screenshot baselines of the main pages. They exist to make UI-library upgrades
// (Ionic 6 -> 7 -> 8, Angular Material, ...) reviewable: after an upgrade a diff
// shows exactly which pages changed. Treat a diff as "look at it", not
// automatically as a failure — regenerate with `yarn test:update-snapshots`
// once the change is intended. Baselines are per OS (see playwright.config.ts).
//
// The map area is blank here (tiles are blocked), which keeps the shots stable.

async function settle(page: any) {
  await appReady(page);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(400); // Ionic page transition
}

test.describe("visual baselines", () => {
  test("start page (signed out)", async ({ page }) => {
    await page.goto("/");
    await settle(page);
    await expect(page).toHaveScreenshot("start-signed-out.png");
  });

  test("start page (signed in)", async ({ page, api }) => {
    await signIn(page, api, user({ roles: ["scholar"] }));
    await page.goto("/");
    await settle(page);
    await expect(page).toHaveScreenshot("start-signed-in.png");
  });

  test("login", async ({ page }) => {
    await page.goto("/user/login");
    await settle(page);
    await expect(page).toHaveScreenshot("login.png");
  });

  test("register", async ({ page }) => {
    await page.goto("/user/register");
    await settle(page);
    await expect(page).toHaveScreenshot("register.png");
  });

  test("info", async ({ page }) => {
    await page.goto("/info");
    await settle(page);
    await expect(page).toHaveScreenshot("info.png");
  });

  test("game list", async ({ page, api }) => {
    api.on(
      "GET",
      /^\/game\/all\/?$/,
      list([game(), game({ _id: "game-2", name: "Harbour tour", place: "Hamburg", tasksCount: 5 })])
    );
    await page.goto("/play-game/play-game-list");
    await settle(page);
    await expect(page.locator("ion-card.game-card")).toHaveCount(2);
    await expect(page).toHaveScreenshot("game-list.png");
  });

  test("game detail", async ({ page, api }) => {
    api.on("GET", "/game/game-1", { message: "ok", content: game() });
    await page.goto("/play-game/game-detail?gameId=game-1");
    await settle(page);
    await expect(page.locator("ion-card-title").first()).toContainText("Campus walk");
    await expect(page).toHaveScreenshot("game-detail.png");
  });

  test("profile", async ({ page, api }) => {
    await signIn(page, api);
    await page.goto("/user/profile");
    await settle(page);
    await expect(page).toHaveScreenshot("profile.png");
  });

  test("edit-game list (empty)", async ({ page, api }) => {
    await signIn(page, api);
    await page.goto("/edit-game-list");
    await settle(page);
    await expect(page).toHaveScreenshot("edit-game-list-empty.png");
  });

  test.describe("playing", () => {
    test.use({ geolocation: { latitude: 51.96, longitude: 7.6, accuracy: 5 }, permissions: ["geolocation"] });
    test("task card over the map", async ({ page, api }) => {
      api.on("GET", "/game/game-1", { message: "ok", content: game() });
      const bundle = { id: "game-1", isVRWorld: false, isVRMirrored: false, gameCode: "Alice", isSingleMode: true, shareData_cbox: false, playerName: "Alice", isRejoin: false };
      await page.goto("/play-game/playing-game/" + encodeURIComponent(JSON.stringify(bundle)));
      await settle(page);
      await expect(page.getByText("GPS accuracy: 5.00 m")).toBeVisible();
      await expect(page).toHaveScreenshot("playing-task.png");
    });
  });
});
