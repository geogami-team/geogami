# Browser smoke tests

Playwright tests that drive the **production build** (`www/`) in a headless browser. The GeoGami API is
fully mocked and every other external host (map tiles, fonts, GitHub, Keycloak) is blocked, so the
tests are fast, deterministic and never touch production.

They are deliberately independent of the app's Angular/Ionic/Capacitor versions: they only see the
rendered app. That makes them the safety net for framework upgrades.

## Run

```bash
yarn verify                 # in geogami-ui: build + unit tests + these tests
# or, with an existing build in www/:
yarn test:e2e               # all projects (desktop + mobile)
cd tests-e2e && npx playwright test specs/play.spec.ts --project=desktop
cd tests-e2e && npx playwright show-report   # after a failure
```

First time on a machine: `cd tests-e2e && yarn install && npx playwright install chromium`.

Playwright is pinned to 1.49.1 because newer releases need Node 20. Bump it when the project moves to Node 20.

## What is covered

| Spec | What it checks |
| --- | --- |
| `routes.spec.ts` | every lazy-loaded page that can be opened directly renders without errors (signed out and signed in); guarded pages redirect signed-out visitors to the login page |
| `auth.spec.ts` | login through the form (trimmed username, tokens stored, errors shown, unconfirmed email), session restore, rejected refresh token |
| `play.spec.ts` | game list → detail → name + consent box → Start (the bundle handed to the playing page is checked) → playing with GPS and map → finishing with and without consent (what is uploaded to `POST /track`); consent-required games |
| `visual.spec.ts` | screenshot baselines of the main pages, desktop and mobile |
| `guards.spec.ts` | the harness itself: a missing local asset is reported, blocked external hosts are not |

Pages that need navigation state from the previous page (create-game-list, create-game-overview, …)
bounce back on a direct visit by design, so they can only be reached through the UI flow.

## Not covered: live sockets (manual check per upgrade step)

The tests block socket.io, so multiplayer and the virtual environment (VE) are only covered as far as
"the page loads". `ngx-socket-io` 3.x talks to the server's socket.io 2.x and to the Unity VE client;
upgrade those three together, never the wrapper alone.

After each upgrade step, on the Netlify deploy preview (it uses the real API), in private windows so no
old service worker answers, with test accounts:

1. **Multiplayer, real world** — signed in as scholar/admin, open a multiplayer game, copy the game link;
   join it from a second browser (or phone) as player 2. Both see each other join; play one task each;
   finish. Check the game appears under *Evaluate* with both players' tracks.
2. **Multiplayer, rejoin** — reload player 2's tab mid-game; it rejoins the same room.
3. **Virtual environment, single player** — open a VE game, enter a name, Start; the VE opens and
   connects (avatar moves, the map panel follows), finish one task.
4. **Virtual environment, multiplayer** — as 1., but with a VE game.

Note anything off in the PR. An automated version (local `geogami-server` with a throwaway database and
two browser sessions) is planned before the Angular 16 step.

## How the mock works

`fixtures.ts` intercepts everything:

- requests to the API origin go to a `MockApi`; **a call without a mock fails the test**, so a new API
  call introduced by an upgrade is noticed
- other external hosts are aborted, and every aborted URL is recorded in `api.blocked`
- `pageerror` and `console.error` fail the test. A "Failed to load resource" message is ignored only
  when its URL is one we blocked on purpose or an API response a test mocked with an error status
- independently of the console, a failed request that was not blocked on purpose, or any 4xx/5xx
  for a local asset, fails the test — so a missing app asset after an upgrade is noticed
- `ignoreKnownErrors` tolerates a known, already-reported app error in one test only. Current
  known issues: the playing page's finish-state errors (`play.spec.ts`) and the handbook's missing
  images (`routes.spec.ts`)

Response shapes follow the real server: lists under `/game/*` are `{ message, content: [...] }`, while
`/user/*` lists are bare arrays.

## Visual baselines

`specs/visual.spec.ts-snapshots/` holds the reference screenshots, one set per project and OS
(`*-desktop-darwin.png`). After an intended UI change, look at the diffs in the report, then run

```bash
cd tests-e2e && npx playwright test visual.spec.ts --update-snapshots
```

A diff is something to look at, not automatically a failure. Generate and compare on the same OS
(or in Playwright's Docker image) — fonts differ between systems.
