import { test, expect, appReady, signIn, user } from "../fixtures";

test.describe("login", () => {
  test("signs in through the form, stores the session and leaves the login page", async ({ page, api }) => {
    api.on("POST", "/user/login", { user: user(), token: "access-1", refreshToken: "refresh-1" });
    await page.goto("/user/login");
    await appReady(page);

    await page.locator("#username input").fill("  tester@example.org ");
    await page.locator("#password input").fill("secret-pw");
    await page.locator("ion-button.submit-btn").click();

    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
    const login = api.callsTo("POST", "/user/login")[0];
    expect(login.body).toEqual({ username: "tester@example.org", password: "secret-pw" }); // trimmed
    expect(await page.evaluate(() => localStorage.getItem("bg_accesstoken"))).toBe("access-1");
    expect(await page.evaluate(() => localStorage.getItem("bg_refreshtoken"))).toBe("refresh-1");
  });

  test("shows the server message and stays on the page when the login fails", async ({ page, api }) => {
    api.on("POST", "/user/login", { message: "Wrong username or password" }, 401);
    await page.goto("/user/login");
    await appReady(page);

    await page.locator("#username input").fill("tester");
    await page.locator("#password input").fill("nope");
    await page.locator("ion-button.submit-btn").click();

    await expect(page.locator("ion-card.error-card")).toContainText("Wrong username or password");
    expect(new URL(page.url()).pathname).toBe("/user/login");
    expect(await page.evaluate(() => localStorage.getItem("bg_accesstoken"))).toBeNull();
  });

  test("an account with an unconfirmed email is sent to verify-email", async ({ page, api }) => {
    const unconfirmed = user({ emailIsConfirmed: false });
    api.on("POST", "/user/login", { user: unconfirmed, token: "a", refreshToken: "r", needsEmailVerification: true });
    api.on("POST", "/user/refresh-auth", { data: { user: unconfirmed }, token: "a", refreshToken: "r" });
    await page.goto("/user/login");
    await appReady(page);
    await page.locator("#username input").fill("tester");
    await page.locator("#password input").fill("pw");
    await page.locator("ion-button.submit-btn").click();
    await expect.poll(() => new URL(page.url()).pathname).toBe("/user/verify-email");
  });

  test("the submit button stays disabled until both fields are filled", async ({ page }) => {
    await page.goto("/user/login");
    await appReady(page);
    await expect(page.locator("ion-button.submit-btn")).toHaveAttribute("disabled", "");
    await page.locator("#username input").fill("tester");
    await expect(page.locator("ion-button.submit-btn")).toHaveAttribute("disabled", "");
    await page.locator("#password input").fill("pw");
    await expect(page.locator("ion-button.submit-btn")).not.toHaveAttribute("disabled", "");
  });
});

test.describe("session", () => {
  test("a stored refresh token restores the session on reload", async ({ page, api }) => {
    await signIn(page, api);
    await page.goto("/user/profile");
    await appReady(page);
    expect(new URL(page.url()).pathname).toBe("/user/profile");
    const refresh = api.callsTo("POST", "/user/refresh-auth")[0];
    expect(refresh.body).toEqual({ token: "stored-refresh-token" });
  });

  test("a rejected refresh token logs the visitor out and returns to the start page", async ({ page, api }) => {
    await page.addInitScript(() => {
      localStorage.setItem("bg_refreshtoken", "expired");
      localStorage.setItem("bg_accesstoken", "expired");
    });
    api.on("POST", "/user/refresh-auth", { message: "Token expired" }, 401);
    await page.goto("/user/profile");
    await appReady(page);
    await expect.poll(() => new URL(page.url()).pathname).toBe("/");
    expect(await page.evaluate(() => localStorage.getItem("bg_refreshtoken"))).toBeNull();
    expect(await page.evaluate(() => localStorage.getItem("bg_accesstoken"))).toBeNull();
  });
});
