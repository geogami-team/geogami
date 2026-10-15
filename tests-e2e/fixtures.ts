import { test as base, expect, Page, Route } from "@playwright/test";

// The production build talks to this origin (src/environments/environment.prod.ts).
export const API = "https://api.geogami.uni-muenster.de";

type Reply = unknown | ((request: { url: URL; body: any; headers: Record<string, string> }) => unknown);

interface Call {
  method: string;
  path: string;
  body: any;
  headers: Record<string, string>;
}

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
};

/** In-browser stand-in for the GeoGami API. Unmocked calls fail the test. */
export class MockApi {
  private routes: { method: string; path: string | RegExp; reply: Reply; status: number }[] = [];
  readonly calls: Call[] = [];
  readonly unmocked: string[] = [];
  /** URLs the tests aborted on purpose; only their load failures may be ignored. */
  readonly blocked = new Set<string>();

  on(method: string, path: string | RegExp, reply: Reply, status = 200) {
    // later registrations win, so a test can override a default
    this.routes.unshift({ method: method.toUpperCase(), path, reply, status });
    return this;
  }

  callsTo(method: string, path: string | RegExp) {
    return this.calls.filter((c) => c.method === method.toUpperCase() && matches(path, c.path));
  }

  async handle(route: Route) {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "OPTIONS") {
      return route.fulfill({ status: 204, headers: CORS });
    }
    if (url.pathname.startsWith("/socket.io")) {
      this.blocked.add(request.url());
      return route.abort("blockedbyclient"); // live tracking is out of scope for the smoke tests
    }
    let body: any = undefined;
    try {
      body = request.postDataJSON();
    } catch {
      body = request.postData();
    }
    const call: Call = { method: request.method(), path: url.pathname, body, headers: request.headers() };
    this.calls.push(call);
    const hit = this.routes.find((r) => r.method === call.method && matches(r.path, call.path));
    if (!hit) {
      this.unmocked.push(`${call.method} ${call.path}`);
      return route.fulfill({ status: 404, headers: CORS, json: { message: "not mocked" } });
    }
    const payload = typeof hit.reply === "function" ? (hit.reply as Function)({ url, body, headers: call.headers }) : hit.reply;
    return route.fulfill({ status: hit.status, headers: CORS, json: payload as any });
  }
}

function matches(pattern: string | RegExp, path: string) {
  return typeof pattern === "string" ? pattern === path : pattern.test(path);
}

// Console messages that are expected in these tests and carry no URL to check against:
//  - mapbox reports its blocked tile/style fetches as "Error: Failed to fetch" (a failing local or API
//    request is still caught, by the requestfailed/response checks below)
//  - with a phone user agent the app calls the Capacitor StatusBar plugin, which has no web implementation
const IGNORED_CONSOLE = [/^Error: Failed to fetch/, /StatusBar does not have web implementation/];

const isLocal = (url: string) => /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(url);

export interface Fixtures {
  api: MockApi;
  consoleErrors: string[];
}

export const test = base.extend<Fixtures>({
  api: [
    async ({ context }, use) => {
      const api = new MockApi();
      defaults(api);
      await context.route("**/*", (route) => {
        const url = new URL(route.request().url());
        if (url.origin === API) return api.handle(route);
        if (url.hostname === "127.0.0.1" || url.hostname === "localhost") return route.continue();
        api.blocked.add(route.request().url());
        return route.abort("blockedbyclient");
      });
      await use(api);
      expect(api.unmocked, "API calls the test did not mock").toEqual([]);
    },
    { auto: true },
  ],

  consoleErrors: [
    async ({ page, api }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (error) => errors.push(`uncaught: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() !== "error") return;
        const text = message.text();
        if (/^Failed to load resource/.test(text)) {
          // Only failures of requests we blocked on purpose, or of API responses a test mocked
          // with an error status (e.g. a 401 login), are expected. Anything else — above all a
          // missing app asset — is a real failure.
          const url = message.location().url;
          if (api.blocked.has(url) || url.startsWith(API + "/")) return;
          errors.push(`console.error: ${text} (${url})`);
          return;
        } else if (IGNORED_CONSOLE.some((re) => re.test(text))) {
          return;
        }
        errors.push(`console.error: ${text}`);
      });
      // Network checks that do not depend on what the app logs:
      page.on("requestfailed", (request) => {
        const reason = request.failure()?.errorText || "";
        if (api.blocked.has(request.url())) return;
        if (reason === "net::ERR_ABORTED") return; // cancelled by the page itself, e.g. on navigation
        errors.push(`request failed: ${request.url()} (${reason})`);
      });
      page.on("response", (response) => {
        if (isLocal(response.url()) && response.status() >= 400) {
          errors.push(`local asset ${response.status()}: ${response.url()}`);
        }
      });
      await use(errors);
      expect(errors, "uncaught exceptions / console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Drops known, already-reported app errors from a test's console-error list (use sparingly, per test). */
export function ignoreKnownErrors(errors: string[], known: RegExp) {
  errors.splice(0, errors.length, ...errors.filter((e) => !known.test(e)));
}

/** Harmless empty responses for everything pages request on load; tests override what they care about. */
function defaults(api: MockApi) {
  api.on("GET", "/appversion/current", { version: "1.0.3" });
  api.on("GET", "/appversion/github-latest", { tag_name: "v1.0.3" });
  api.on("GET", "/editor-visibility", { revision: 1, features: {}, updatedAt: null, updatedBy: null });
  // list endpoints under /game wrap their rows as { message, content }; /user/* return bare arrays
  api.on("GET", /^\/game\/all\/?$/, list([]));
  api.on("GET", "/game/allwithlocs", list([]));
  api.on("GET", "/game/usergames", list([]));
  api.on("GET", "/game/drafts", list([]));
  api.on("GET", "/user/games", []);
  api.on("GET", "/user/user", []);
  api.on("GET", "/audit/unread-count", { count: 0, lastSeenAt: null });
  api.on("GET", "/audit", { items: [] });
  api.on("POST", "/audit/seen", { success: true });
  api.on("GET", "/event/userevents", { content: [] });
}

/** The envelope the API puts around lists of games. */
export const list = (content: unknown[]) => ({ message: "ok", content });

export const user = (overrides: Record<string, unknown> = {}) => ({
  _id: "user-1",
  username: "tester",
  email: "tester@example.org",
  roles: ["scholar"],
  emailIsConfirmed: true,
  language: "en",
  ...overrides,
});

/** Starts the page already signed in (session restored through the refresh token). */
export async function signIn(page: Page, api: MockApi, who = user()) {
  await page.addInitScript(() => {
    localStorage.setItem("bg_refreshtoken", "stored-refresh-token");
    localStorage.setItem("bg_accesstoken", "stored-access-token");
  });
  api.on("POST", "/user/refresh-auth", {
    data: { user: who },
    token: "fresh-access-token",
    refreshToken: "fresh-refresh-token",
  });
}

/** Waits until Ionic has hydrated and the routed page has rendered. */
export async function appReady(page: Page) {
  await page.waitForSelector("ion-app.hydrated", { timeout: 20_000 });
  await page.waitForSelector("ion-router-outlet .ion-page:not(.ion-page-hidden)", { timeout: 20_000 });
}

/** A published single-player real-world game with one "where are you" task. */
export const game = (overrides: Record<string, unknown> = {}) => ({
  _id: "game-1",
  name: "Campus walk",
  place: "Münster",
  user: "user-1",
  tracking: true,
  isPublished: true,
  // single-player games carry no isMultiplayerGame field: the list filters on `== undefined`
  isVRWorld: false,
  isVRMirrored: false,
  mapSectionVisible: true,
  geofence: false,
  tasksCount: 1,
  bbox: [7.59, 51.95, 7.61, 51.97],
  tasks: [
    {
      id: 1,
      name: "Tasktypes.selfLocation",
      type: "theme-loc",
      category: "theme",
      question: { type: 1, key: "QuestionText.whereAreYouNow", text: "Where are you now?" },
      answer: { type: 1 },
      evaluate: "evalDistanceToPoint",
      settings: {},
      mapFeatures: {},
    },
  ],
  ...overrides,
});
