import { test, expect, appReady, game, list, ignoreKnownErrors, MockApi } from "../fixtures";

test.describe("play a game", () => {
  test("the game list shows published games and opens the detail page", async ({ page, api }) => {
    api.on("GET", /^\/game\/all\/?$/, list([game(), game({ _id: "game-2", name: "Harbour tour", place: "Hamburg" })]));
    api.on("GET", "/game/game-1", { message: "ok", content: game() });

    await page.goto("/play-game/play-game-list");
    await appReady(page);
    await expect(page.locator("ion-card.game-card")).toHaveCount(2);
    await expect(page.locator("ion-card.game-card").first()).toContainText("Campus walk");
    await expect(page.locator("ion-card.game-card").last()).toContainText("Harbour tour");

    await page.locator("ion-card.game-card", { hasText: "Campus walk" }).click();
    await expect.poll(() => page.url()).toContain("/play-game/game-detail?gameId=game-1");
    await expect(page.locator("ion-card-title").first()).toContainText("Campus walk");
  });

  test("Start stays disabled until the player has entered a name", async ({ page, api }) => {
    api.on("GET", "/game/game-1", { message: "ok", content: game() });
    await page.goto("/play-game/game-detail?gameId=game-1");
    await appReady(page);
    const start = page.locator("ion-footer ion-button");
    await expect(start).toBeVisible();
    await expect(start).toHaveAttribute("disabled", "");

    await page.locator("ion-input input").first().fill("Alice");
    await expect(start).not.toHaveAttribute("disabled", "");
  });

  test("a game that requires consent cannot be started until the box is ticked", async ({ page, api }) => {
    api.on("GET", "/game/game-1", { message: "ok", content: game({ disableShareData: true }) });
    await page.goto("/play-game/game-detail?gameId=game-1");
    await appReady(page);
    const start = page.locator("ion-footer ion-button");
    await page.locator("ion-input input").first().fill("Alice");
    await expect(start).toHaveAttribute("disabled", "");
    await page.locator("ion-checkbox").first().click();
    await expect(start).not.toHaveAttribute("disabled", "");
  });
});

// Every game below is started through the UI (name, consent box, Start), so the
// Start handler and the consent hand-over to the playing page are covered too.
test.describe("playing a real-world single-player game", () => {
  test.use({ geolocation: { latitude: 51.96, longitude: 7.6, accuracy: 5 }, permissions: ["geolocation"] });

  const active = (page: any) => page.locator("app-playing-game");

  /** On the detail page: enter a name, optionally give consent, press Start and wait for the first GPS fix. */
  const startFromDetail = async (page: any, opts: { name: string; consent: boolean }) => {
    await expect(page.locator("ion-card-title").first()).toContainText("Campus walk");
    await page.locator("ion-input input").first().fill(opts.name);
    const box = page.locator("ion-checkbox").first();
    if (opts.consent) await box.click();
    await expect(box).toHaveClass(opts.consent ? /checkbox-checked/ : /^(?!.*checkbox-checked)/);
    await page.locator("ion-footer ion-button").click();

    await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/play-game\/playing-game\//);
    await appReady(page);
    // the first GPS fix means the game, map and position stream are all up
    await expect(page.getByText("GPS accuracy: 5.00 m")).toBeVisible();
  };

  /** The bundle the Start button handed to the playing page (it travels in the URL). */
  const startedWith = (page: any) =>
    JSON.parse(decodeURIComponent(new URL(page.url()).pathname.replace("/play-game/playing-game/", "")));

  const openDetail = async (page: any, api: MockApi) => {
    api.on("GET", "/game/game-1", { message: "ok", content: game() });
    await page.goto("/play-game/game-detail?gameId=game-1");
    await appReady(page);
  };

  // KNOWN APP ISSUES (both harmless to the player, ignored here and only here until fixed):
  // after the last task the page still runs initTask() for a task that does not exist, so
  //  - the template evaluates `task.answer?.…` with `task` undefined (playing-game.page.html):
  //    "TypeError: Cannot read properties of undefined (reading 'answer')"
  //  - if "Done" is tapped while that initTask() is still awaiting, map.remove() runs first and the
  //    leftover initTask() then calls landmarkControl.removeQT() on the removed map:
  //    "TypeError: Cannot read properties of undefined (reading 'getLayer')"
  const FINISH_STATE_TYPEERROR = /Cannot read properties of undefined \(reading '(answer|getLayer)'\)/;

  const finish = async (page: any, consoleErrors: string[]) => {
    // "next" is ignored until the task has finished initialising, so retry the tap
    await expect(async () => {
      await active(page).locator("ion-toolbar ion-buttons[slot=end] ion-button").click({ timeout: 2000 });
      await expect(page.getByText("You finished the game!")).toBeVisible({ timeout: 2000 });
    }).toPass({ timeout: 15_000 });
    await page.locator("ion-button", { hasText: /done/i }).first().click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
    ignoreKnownErrors(consoleErrors, FINISH_STATE_TYPEERROR);
  };

  test("Start opens the game with the player's name, the task, the map and the GPS accuracy", async ({ page, api }) => {
    await openDetail(page, api);
    await startFromDetail(page, { name: "Alice", consent: false });

    expect(startedWith(page)).toMatchObject({ id: "game-1", playerName: "Alice", isSingleMode: true, isVRWorld: false, shareData_cbox: false });
    await expect(active(page)).toContainText("Campus walk (Alice)");
    await expect(active(page)).toContainText("Task (1/1)");
    await expect(active(page)).toContainText("Where are you now?");
    await expect(page.locator("canvas.mapboxgl-canvas")).toHaveCount(1);
  });

  test("finishing without data-sharing consent does not upload the track", async ({ page, api, consoleErrors }) => {
    await openDetail(page, api);
    await startFromDetail(page, { name: "Alice", consent: false });
    await finish(page, consoleErrors);
    expect(api.callsTo("POST", "/track")).toHaveLength(0);
  });

  test("list -> detail -> consent -> Start -> finish uploads the track with events and only whitelisted device fields", async ({ page, api, consoleErrors }) => {
    api.on("GET", /^\/game\/all\/?$/, list([game()]));
    api.on("GET", "/game/game-1", { message: "ok", content: game() });
    api.on("POST", "/track", { success: true }, 201);

    await page.goto("/play-game/play-game-list");
    await appReady(page);
    await page.locator("ion-card.game-card", { hasText: "Campus walk" }).click();
    await startFromDetail(page, { name: "Alice", consent: true });
    expect(startedWith(page)).toMatchObject({ playerName: "Alice", shareData_cbox: true });
    await finish(page, consoleErrors);

    const uploads = api.callsTo("POST", "/track");
    expect(uploads).toHaveLength(1);
    const track = uploads[0].body;
    expect(track.game).toBe("game-1");
    expect(track.name).toBe("Campus walk");
    expect(track.players).toEqual(["Alice"]);
    expect(track.playersCount).toBe(1);
    expect(track.events.map((e: any) => e.type)).toEqual(["INIT_GAME", "INIT_TASK", "FINISHED_GAME"]);
    expect(new Date(track.start).getTime()).toBeLessThanOrEqual(new Date(track.end).getTime());
    expect(Object.keys(track.device).sort()).toEqual(
      ["appBuild", "appId", "appName", "appVersion", "device_manufacturer", "isVirtual", "model", "operatingSystem", "osVersion", "platform"].sort()
    );
    expect(track.instructor).toBeUndefined();
    expect(track.event).toBeUndefined();
  });
});
