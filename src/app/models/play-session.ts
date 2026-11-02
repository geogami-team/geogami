/** Who may open the "Live plays" page (the server enforces the same rule). */
export const LIVE_PLAYS_ROLES: ReadonlyArray<string> = ["admin"];

export type PlayWorld = "real" | "virtual";
export type PlayMode = "single" | "multi";
export type PlayStatus = "playing" | "finished" | "left" | "closed" | "abandoned";
export type SaveStatus = "not_requested" | "pending" | "saved" | "failed" | "unknown";

// The game page in the VE's frame asks the app around the VE (playing-virenv) which
// platform and app version the player is on; its own platform is always "web".
export const HOST_INFO_REQUEST = "geogami:host-info-request";
export const HOST_INFO_MESSAGE = "geogami:host-info";
export const HOST_PLATFORMS: ReadonlyArray<string> = ["web", "ios", "android", "electron"];

export const PLAY_STATUSES: ReadonlyArray<PlayStatus> = ["playing", "finished", "left", "closed", "abandoned"];
export const SAVE_STATUSES: ReadonlyArray<SaveStatus> = ["saved", "failed", "pending", "unknown", "not_requested"];

/** Ionic colour per status, for the badges. */
export const STATUS_COLOR: Readonly<Record<PlayStatus, string>> = {
  playing: "success",
  finished: "primary",
  left: "medium",
  closed: "warning",
  abandoned: "dark",
};
export const SAVE_COLOR: Readonly<Record<SaveStatus, string>> = {
  saved: "success",
  failed: "danger",
  pending: "warning",
  unknown: "medium",
  not_requested: "light",
};

/** A play as GET /play-session/live and GET /play-session return it. */
export interface PlaySessionView {
  playId: string;
  firstSeenAt: string;
  game: { id: string | null; name: string | null };
  event: { id: string; name: string | null } | null;
  world: PlayWorld;
  mode: PlayMode;
  rejoin: boolean;
  platform: string;
  /** Played in the VE: the game page ran in its frame, platform and app are the app around it. */
  embedded: boolean;
  appVersion: string | null;
  appBuild: string | null;
  webVersion: string | null;
  webCommit: string | null;
  webDeployId: string | null;
  webBuiltAt: string | null;
  startedAt: string | null;
  clientStartedAt: string | null;
  endedAt: string | null;
  clientEndedAt: string | null;
  durationMs: number | null;
  endReason: string | null;
  resumeCount: number;
  status: PlayStatus;
  save: SaveStatus | null;
  uploadHttpStatus: number | null;
  startMissing: boolean;
}

export interface LivePlays {
  serverTime: string;
  counts: { playing: number; saving: number };
  items: PlaySessionView[];
  truncated: boolean;
}

export interface PlayHistoryPage {
  serverTime: string;
  items: PlaySessionView[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface PlayHistoryFilters {
  from?: string;
  to?: string;
  game?: string;
  event?: string;
  status?: PlayStatus | "";
  save?: SaveStatus | "";
  playId?: string;
}

const items = (raw: any): PlaySessionView[] => (raw && Array.isArray(raw.items) ? raw.items : []);

/** The live answer, or null when it is not one (then the page keeps what it had). */
export function parseLivePlays(raw: any): LivePlays | null {
  if (!raw || !raw.counts || !Array.isArray(raw.items)) return null;
  return {
    serverTime: raw.serverTime,
    counts: { playing: Number(raw.counts.playing) || 0, saving: Number(raw.counts.saving) || 0 },
    items: items(raw),
    truncated: !!raw.truncated,
  };
}

export function parsePlayHistory(raw: any): PlayHistoryPage | null {
  if (!raw || !Array.isArray(raw.items)) return null;
  return {
    serverTime: raw.serverTime,
    items: items(raw),
    hasMore: !!raw.hasMore,
    nextCursor: raw.nextCursor || null,
  };
}

/** "45 s", "12 min", "1 h 05 min". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !isFinite(ms) || ms < 0) return "";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
}

/** The first characters of a commit or play id, enough to recognise it. */
export function shortId(id: string | null | undefined, length = 8): string {
  return id ? id.slice(0, length) : "";
}

/** A random v4 UUID; crypto.randomUUID is missing in older WebViews and insecure contexts. */
export function newPlayId(cryptoImpl: any = typeof crypto !== "undefined" ? crypto : null): string {
  if (cryptoImpl && typeof cryptoImpl.randomUUID === "function") {
    return cryptoImpl.randomUUID();
  }
  const bytes = new Uint8Array(16);
  if (cryptoImpl && typeof cryptoImpl.getRandomValues === "function") {
    cryptoImpl.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface DiagnosticDetails {
  playId: string | null;
  gameId: string | null;
  gameName: string | null;
  world: PlayWorld;
  mode: PlayMode;
  taskNo: number | null;
  tasksCount: number | null;
  startedAt: Date | null;
  platform: string;
  embedded: boolean;
  appVersion: string | null;
  appBuild: string | null;
  webVersion: string | null;
  webCommit: string | null;
  webDeployId: string | null;
  webBuiltAt: string | null;
}

/**
 * The text "Copy diagnostic details" puts on the clipboard, for a player to paste
 * into a problem report. An admin finds the play by its id on the Live plays page.
 * Deliberately in English and without the player's name.
 */
export function buildDiagnostics(d: DiagnosticDetails): string {
  const lines = [
    "GeoGami diagnostic details",
    `Play ID: ${d.playId || "none"}`,
    `Game: ${d.gameName || "?"} (${d.gameId || "?"})`,
    `Type: ${d.world === "virtual" ? "virtual environment" : "real world"}, ${
      d.mode === "multi" ? "multiplayer" : "single player"
    }`,
  ];
  if (d.taskNo != null) {
    lines.push(`Task: ${d.taskNo}${d.tasksCount != null ? ` of ${d.tasksCount}` : ""}`);
  }
  if (d.startedAt) lines.push(`Started: ${d.startedAt.toISOString()}`);
  lines.push(`Platform: ${d.platform}${d.embedded ? " (game in the VE frame)" : ""}`);
  lines.push(
    `Web build: ${d.webVersion ? `${d.webVersion}, commit ` : ""}${d.webCommit || "?"}${
      d.webDeployId ? ` (deploy ${d.webDeployId})` : ""
    }${d.webBuiltAt ? `, built ${d.webBuiltAt}` : ""}`
  );
  if (d.appVersion || d.appBuild) {
    lines.push(`App: ${d.appVersion || "?"}${d.appBuild ? ` (build ${d.appBuild})` : ""}`);
  }
  return lines.join("\n");
}
