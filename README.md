<p align="center">
  <img src=https://github.com/origami-team/geogami/blob/master/src/assets/icons/icon.png width="100" alt="GeoGami logo"/>
</p>

<h1 align="center">GeoGami UI</h1>

<p align="center">
  Cross-platform mobile and web client for the <strong>GeoGami</strong> location-based game platform.
</p>

<p align="center">
  <a href="https://doi.org/10.5281/zenodo.5384903"><img src="https://zenodo.org/badge/DOI/10.5281/zenodo.5384903.svg" alt="DOI"/></a>
  <img src="https://img.shields.io/badge/Angular-12-DD0031?logo=angular" alt="Angular 12"/>
  <img src="https://img.shields.io/badge/Ionic-6-3880FF?logo=ionic" alt="Ionic 6"/>
  <img src="https://img.shields.io/badge/Capacitor-iOS%20%7C%20Android-119EFF?logo=ionic" alt="Capacitor"/>
</p>

GeoGami is a location-based game built by the **Spatial Intelligence Lab (SIL)** at the Institute for Geoinformatics, University of Münster. The app lets users **play and create map-based games** in the real world or in a virtual environment, with the goal of training and studying spatial cognition.

This repository contains the **front-end client** — an Angular + Ionic application that runs as a web app, an iOS app, and an Android app from a single codebase.

> Looking for the other components?
> - **Backend API**: [`../geogami-server`](https://github.com/geogami-team/origami-backend)
> - **Analytics dashboard**: [`../geogami-dashboard`](https://github.com/geogami-team/geogami-dashboard)
> - **Virtual environment**: [`../geogami-virtual-environment-dev`](https://github.com/geogami-team/geogami-virtual-environment-dev)

---

## Table of contents

- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Available scripts](#available-scripts)
- [Project structure](#project-structure)
- [Building for mobile (iOS / Android)](#building-for-mobile-ios--android)
- [Internationalisation](#internationalisation)
- [Class QR codes (instructor sharing)](#class-qr-codes-instructor-sharing)
- [Contributing](#contributing)
- [Map Features and Task Types in GeoGami](#map-features-and-task-types-in-geogami)
- [Contact](#contact)
- [License](#license)

---

## Tech stack

| Area | Technology |
|---|---|
| Framework | Angular 12, Ionic 6 |
| Native shell | Capacitor 3 (iOS, Android) |
| Maps | Leaflet, Mapbox GL |
| State / forms | Reactive forms, RxJS |
| UI components | Angular Material, Ionic Components |
| i18n | `@ngx-translate/core` |
| HTTP | Angular HttpClient (JWT bearer) |

## Prerequisites

- **Node.js** 14.x – 16.x (Angular 12 isn't compatible with newer Node versions)
- **npm** 6+ or **yarn** 1.x
- **Ionic CLI**: `npm i -g @ionic/cli`
- For mobile builds:
  - iOS: macOS, Xcode 14+, CocoaPods
  - Android: Android Studio with SDK 33+

## Getting started

```bash
git clone <repo-url>
cd geogami-ui
npm install
ionic serve         # opens http://localhost:8100
```

The dev server proxies API calls to the URL configured in `src/environments/environment.ts`.

## Configuration

Per-environment configuration lives in `src/environments/`:

| File | Used when |
|---|---|
| `environment.ts` | `ionic serve`, dev builds |
| `environment.prod.ts` | `ionic build --prod` |

Typical values:

```ts
export const environment = {
  production: false,
  apiURL: 'http://localhost:3000',         // GeoGami server
  dashboardURL: 'http://localhost:3838',   // Shiny dashboard
  mapboxAccessToken: '<your-mapbox-token>',// Required for Mapbox GL map rendering

  // Virtual environment (only required for virtual-world games)
  uiURL: 'http://localhost:8100',          // UI origin used by the embedded WebGL view
  webglURL: 'http://localhost:50544'       // Unity WebGL build served locally
};
```

## Available scripts

| Command | Purpose |
|---|---|
| `npm start` / `ionic serve` | Run dev server with live reload |
| `npm run build` | Build the web bundle into `www/` |
| `npm run build-browser` | Production browser build |
| `npm test` | Run Karma unit tests |
| `npm run lint` | TSLint check |
| `ionic capacitor sync ios` | Copy `www/` into the iOS Xcode project |
| `ionic capacitor sync android` | Copy `www/` into the Android Studio project |

## Project structure

```
src/app/
├── pages/
│   ├── play-game/           # Real-world & virtual game playback
│   ├── create-game/         # Author new games (real + VR)
│   ├── edit-game/           # Modify existing games
│   ├── analyze-game/        # Track listing + dashboard launcher
│   ├── multiplayer/         # Real-time multiplayer flows
│   ├── user/                # Login, register, profile, verify-email,
│   │                        # reset-password, user-management (admin)
│   ├── showroom/            # Map / task / world demos
│   └── handbook/            # In-app help
├── services/                # AuthService, UtilService, …
├── models/                  # TypeScript interfaces and shared models
└── interceptors/            # JWT refresh handling
```

## Building for mobile (iOS / Android)

```bash
ionic capacitor build ios       # opens the Xcode project
ionic capacitor build android   # opens Android Studio
```

The `ios/` and `android/` folders are tracked in this repo so push notifications, plugins, and signing settings stay reproducible.

## Internationalisation

Translation files live at `src/assets/i18n/<locale>.json`. Currently shipped: `en`, `de`, `fr`, `pt`, `ar`. Add a new key under the appropriate namespace; the UI uses Angular `| translate` pipes everywhere, including dynamic strings such as toasts.

## Class QR codes (instructor sharing)

A logged-in user viewing a **single-player** game can open a **Class QR code** (the QR button in the game-detail header). The QR/link encodes the game plus the sharing user's id and display name, so it doubles as a classroom hand-out:

- A student who scans it (phone camera or the in-app scanner) lands on the game with it pre-selected.
- Data-sharing consent is **forced on and locked**, with a note naming the instructor — the play must be shared for the teacher to receive it.
- When the session ends, the track is saved with that user as its **instructor**, so the play appears in the **instructor's** dashboard rather than the game creator's.

Multiplayer games are unchanged — they keep their existing room-based QR (limited, fixed participant count). Normal solo plays (no instructor in the link) still attribute to the game creator as before. Who can see which track, and per-track sharing, are handled server-side — see the server README's "Class sharing (instructor QR) & track access" section.

## Contributing

- Branch from `dev` (PRs target `master`), open a PR, and reference an issue when applicable.
- Please run `npm run lint` and the unit tests before pushing.
- Bug reports and feature requests: <https://github.com/geogami-team/geogami/issues>.

---

## Map Features and Task Types in GeoGami

The sections below describe the gameplay primitives the UI exposes — useful both for new players and for contributors implementing changes to game authoring or playback.

### Task types

GeoGami groups task types into **Navigation tasks** and **Thematic tasks**, plus a standalone **Information** module that lets game creators give the player hints, rules, or context before play.

#### Navigation tasks

> Navigation tasks direct the player to a new location.

| Navigation to flag | Navigation with arrow | Navigation via text | Navigation via photo |
| ------------------ | --------------------- | ------------------- | -------------------- |

#### Thematic tasks

> Thematic tasks are location-specific tasks that probe specific spatial skills.

| Self-location | Object location | Direction determination | Free task |
| ------------- | --------------- | ----------------------- | --------- |

#### Free tasks

> Free tasks let game creators freely combine question and answer types to build quizzes or custom thematic challenges.

**Supported question types**

| Type | Description |
| --- | --- |
| `TEXT` | Plain text question |
| `MAP_FEATURE` | Question referencing a map feature |
| `MAP_FEATURE_FREE` | Free-form map-feature question |
| `MAP_FEATURE_PHOTO` | Map-feature question with a photo |
| `MAP_TARGET` | Question targeting a specific map location |
| `MAP_DIRECTION` | Question about a map direction |
| `MAP_DIRECTION_MARKER` | Direction question shown via a map marker |
| `MAP_DIRECTION_PHOTO` | Direction question shown via a photo |
| `NAV_INSTRUCTION` | Navigation instruction prompt |
| `NAV_INSTRUCTION_PHOTO` | Navigation instruction shown via a photo |
| `PHOTO` | Photo-based question |
| `INFO` | Informational prompt (no question) |

**Supported answer types**

| Type | Description |
| --- | --- |
| `POSITION` | Player provides their current position |
| `MAP_POINT` | Player picks a point on the map |
| `DIRECTION` | Player indicates a direction |
| `MAP_DIRECTION` | Player indicates a direction on the map |
| `PHOTO` | Player submits a photo |
| `DRAW` | Player draws on the map |
| `MULTIPLE_CHOICE` | Multiple-choice answer |
| `MULTIPLE_CHOICE_TEXT` | Multiple-choice with text options |
| `TEXT` | Free-text answer |
| `NUMBER` | Numeric answer |
| `INFO` | Informational acknowledgement (no answer) |

### Map features

Each task can be configured with a combination of **map settings** and **marker / overlay settings**.

#### Map settings

| Setting | Options |
| --- | --- |
| `Zoom` | manual · zoom to task · zoom to game · off |
| `Map Section` | movable · automatically-centered · static |
| `Map Rotation` | manual · automatic · automatic on-demand · fixed to north |
| `Map Type` | standard · map selection · satellite · satellite on-demand · satellite swipe · 3D · 3D on-demand · blank · blank + satellite swipe |
| `Reduced Information` | strips non-essential map details to test orientation in minimal-information settings |
| `Switch Layer` (virtual worlds) | toggles between map material and satellite layer inside the Unity virtual environment |

#### Marker / overlay settings

| Setting | What it does | Modes |
| --- | --- | --- |
| `Location Marker` | Shows the player's current position | on · on-demand · at start of task · off |
| `View Direction Marker` | Shows the device's current heading | on · on-demand · at start of task · off |
| `Track Recording` | Records the player's route | for the entire game · for the current task · also for the next task |
| `Buffer` | Reveals a circular section of the map around the player | configurable diameter, **20–100 m** |
| `Highlight Landmarks` | Highlights landmarks near the destination (with optional explicit `landmarkFeatures` list) | on · off |
| `Highlight Street Section` | Highlights the street segment at the destination | on · off |

### Game environments

GeoGami games can be played in two environments:

- **Real world** — outdoor play using the device's GPS and compass.
- **Virtual world** — indoor / remote play in a Unity-based 3D environment.

Both environments support **single-player** and **multiplayer** modes, with the same task and map-feature catalogue.

---

## Contact

**Spatial Intelligence Lab (SIL)** — Institute for Geoinformatics, University of Münster

| | |
| --- | --- |
| Address | Heisenbergstraße 2, 48149 Münster |
| Email | geogami(at)uni-muenster.de |
| Website | <https://geogami.ifgi.de> |
| Team | <https://geogami.ifgi.de/kontakt.html#team> |

## License

GeoGami is published under the **MIT License**. © 2026 — GeoGami. See the root project for full attribution and citation information.
