import { Injectable } from "@angular/core";
import { Capacitor, Plugins } from "@capacitor/core";
import { environment } from "src/environments/environment";
import { BUILD_INFO } from "src/environments/build-info";
import {
  DiagnosticDetails,
  HOST_INFO_MESSAGE,
  HOST_INFO_REQUEST,
  HOST_PLATFORMS,
  PlayMode,
  PlayWorld,
  buildDiagnostics,
  newPlayId,
} from "../models/play-session";

export interface PlayDescriptor {
  game: string;
  event?: string | null;
  world: PlayWorld;
  mode: PlayMode;
  rejoin?: boolean;
}

/** The platform and app a play is recorded with. */
interface Identity {
  platform: string;
  appVersion: string | null;
  appBuild: string | null;
}

interface CurrentPlay {
  playId: string;
  descriptor: PlayDescriptor;
  /** Device clock, for the diagnostic details. */
  startedAt: Date;
  /** Monotonic clock, for the play time. */
  startedMs: number;
  /** A definitive end (finished/left) was made; it may still be waiting in the queue. */
  ended: boolean;
  /** pagehide reported "closed"; the page may still come back from the back/forward cache. */
  closed: boolean;
  /** Runs in the web app the VE loads into its frame: the platform is the app around it. */
  embedded: boolean;
  /** The app around the VE was asked (once per play, so a silent one delays only the start). */
  hostAsked: boolean;
  /** Numbers the messages, so the server can tell a late "closed" from a newer resume. */
  seq: number;
}

interface Outgoing {
  play: CurrentPlay;
  fields: Record<string, any>;
  sent: boolean;
}

// Each message waits at most this long for the previous one, so they reach the
// server in order without one stuck request holding up the rest.
const ORDER_WAIT_MS = 5000;

const monotonicNow = () =>
  typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();

const text = (value: any): string | null => (typeof value === "string" && value ? value : null);

/**
 * Tells the server that a game is being played, for the admins' "Live plays" page:
 * one message when the play starts, one when it ends, and whether its track was saved.
 * No player name, user or location is sent.
 *
 * It must never affect the game. Messages go out with fetch/sendBeacon rather than
 * HttpClient, so the token interceptor (which turns a 403 into a token refresh and can
 * log the user out) never sees them; the callers never wait for them; every failure
 * is swallowed.
 */
@Injectable({ providedIn: "root" })
export class PlaySessionService {
  private current: CurrentPlay | null = null;
  private queue: Promise<void> = Promise.resolve();
  /** Messages in the queue that have not gone out yet. */
  private waiting: Outgoing[] = [];
  private device: { appVersion: string | null; appBuild: string | null } | null = null;
  /** The app around the VE, once it has answered. */
  private host: Identity | null = null;
  private hostLanguage: string | null = null;
  private hostWaitMs = 2000;
  private listening = false;

  private get url(): string {
    return `${environment.apiURL}/play-session/events`;
  }

  /**
   * A new play begins (a rejoin is a new play too). The game page can run its start
   * twice for one play (multiplayer starts from more than one path); while a play of
   * the same game is running, it stays the current play.
   */
  start(descriptor: PlayDescriptor): void {
    try {
      this.listen();
      const d: PlayDescriptor = { ...descriptor, event: descriptor.event || null, rejoin: !!descriptor.rejoin };
      const previous = this.current;
      if (previous && !previous.ended) {
        if (samePlay(previous.descriptor, d)) return;
        this.end("left");
      }
      this.current = {
        playId: newPlayId(),
        descriptor: d,
        startedAt: new Date(),
        startedMs: monotonicNow(),
        ended: false,
        closed: false,
        embedded: d.world === "virtual" && !!this.hostWindow(),
        hostAsked: false,
        seq: 0,
      };
      this.send(this.current, { type: "start" });
    } catch {
      // never affects the game
    }
  }

  /** The play ended in the app: all tasks done, or the player left the game. The first end counts. */
  end(reason: "finished" | "left"): void {
    try {
      const play = this.current;
      if (!play || play.ended) return;
      play.ended = true;
      play.closed = false;
      this.send(play, { type: "end", reason, elapsedMs: monotonicNow() - play.startedMs });
    } catch {
      // never affects the game
    }
  }

  /** At the finish: will the track be saved (the player agreed to share it) or not. */
  uploadExpected(willUpload: boolean): void {
    try {
      if (!this.current) return;
      this.send(this.current, { type: "upload", status: willUpload ? "pending" : "not_requested" });
    } catch {
      // never affects the game
    }
  }

  /**
   * Reports how the track upload ended. It only watches the promise the game already
   * has (with handlers of its own), so the game's handling of the upload is unchanged.
   * Saved means what the game counts as saved: HTTP 201.
   */
  watchUpload(upload: Promise<any>): void {
    try {
      const play = this.current;
      if (!play || !upload || typeof upload.then !== "function") return;
      upload.then(
        (res) => {
          const status = res && typeof res.status === "number" ? res.status : null;
          this.send(play, { type: "upload", status: status === 201 ? "saved" : "failed", httpStatus: status });
        },
        (err) => {
          const status = err && typeof err.status === "number" ? err.status : 0;
          this.send(play, { type: "upload", status: "failed", httpStatus: status });
        }
      );
    } catch {
      // never affects the game
    }
  }

  /** The text for "Copy diagnostic details". */
  diagnostics(extra: { gameId?: string; gameName?: string; world: PlayWorld; mode: PlayMode; taskNo?: number; tasksCount?: number }): string {
    const play = this.current;
    const identity = this.identity(play);
    const details: DiagnosticDetails = {
      playId: play ? play.playId : null,
      gameId: (play && play.descriptor.game) || extra.gameId || null,
      gameName: extra.gameName || null,
      world: play ? play.descriptor.world : extra.world,
      mode: play ? play.descriptor.mode : extra.mode,
      taskNo: extra.taskNo ?? null,
      tasksCount: extra.tasksCount ?? null,
      startedAt: play ? play.startedAt : null,
      platform: identity.platform,
      embedded: !!(play && play.embedded),
      appVersion: identity.appVersion,
      appBuild: identity.appBuild,
      webVersion: text(BUILD_INFO.version),
      webCommit: text(BUILD_INFO.commit),
      webDeployId: text(BUILD_INFO.deployId),
      webBuiltAt: text(BUILD_INFO.builtAt),
    };
    return buildDiagnostics(details);
  }

  /**
   * For the VE page (playing-virenv), the app around the VE: the game page in the VE's
   * frame asks what platform and app the player is really on, and which language they
   * selected, and this answers it.
   */
  async answerHost(event: MessageEvent, language: string): Promise<void> {
    try {
      await this.loadDevice();
      const source = event.source as Window;
      const origin = event.origin && event.origin !== "null" ? event.origin : "*";
      source.postMessage(
        {
          type: HOST_INFO_MESSAGE,
          platform: Capacitor.platform,
          appVersion: this.device.appVersion,
          appBuild: this.device.appBuild,
          language,
        },
        origin
      );
    } catch {
      // never affects the game
    }
  }

  // The page is being unloaded or put into the back/forward cache. Best effort: the
  // event can be missed (often on mobile), and sendBeacon only queues the message.
  private onPageHide = () => {
    try {
      // Messages still waiting in the queue (e.g. an end behind a slow start) go now,
      // or they would be lost with the page.
      for (const item of this.waiting.splice(0)) {
        item.sent = true;
        this.beacon(this.body(item));
      }
      const play = this.current;
      if (!play || play.ended || play.closed) return;
      play.closed = true;
      this.beacon(
        this.body(this.outgoing(play, { type: "end", reason: "closed", elapsedMs: monotonicNow() - play.startedMs }))
      );
    } catch {
      // never affects the game
    }
  };

  // The page came back from the back/forward cache: the play goes on.
  private onPageShow = (event: PageTransitionEvent) => {
    try {
      const play = this.current;
      if (!event || !event.persisted || !play || play.ended || !play.closed) return;
      play.closed = false;
      this.send(play, { type: "resume" });
    } catch {
      // never affects the game
    }
  };

  // Added once and kept: they do nothing while no play is running. No Capacitor App
  // listener on purpose: the playing page calls Plugins.App.removeAllListeners().
  private listen() {
    if (this.listening || typeof window === "undefined") return;
    this.listening = true;
    window.addEventListener("pagehide", this.onPageHide);
    window.addEventListener("pageshow", this.onPageShow);
  }

  private outgoing(play: CurrentPlay, fields: Record<string, any>): Outgoing {
    play.seq += 1;
    return { play, fields: { ...fields, seq: play.seq, clientTime: new Date().toISOString() }, sent: false };
  }

  private send(play: CurrentPlay, fields: Record<string, any>) {
    const item = this.outgoing(play, fields);
    this.waiting.push(item);
    this.queue = this.queue
      .then(async () => {
        await this.loadDevice();
        if (play.embedded && !play.hostAsked) {
          play.hostAsked = true;
          await this.askHost();
        }
        if (item.sent) return; // pagehide sent it already
        item.sent = true;
        this.waiting = this.waiting.filter((w) => w !== item);
        const message = this.post(this.body(item));
        await Promise.race([message, new Promise((resolve) => setTimeout(resolve, ORDER_WAIT_MS))]);
      })
      .catch(() => {});
  }

  private body({ play, fields }: Outgoing): string {
    const d = play.descriptor;
    const identity = this.identity(play);
    return JSON.stringify({
      ...fields,
      playId: play.playId,
      game: d.game,
      event: d.event,
      world: d.world,
      mode: d.mode,
      rejoin: d.rejoin,
      platform: identity.platform,
      embedded: play.embedded,
      appVersion: identity.appVersion,
      appBuild: identity.appBuild,
      webVersion: text(BUILD_INFO.version),
      webCommit: text(BUILD_INFO.commit),
      webDeployId: text(BUILD_INFO.deployId),
      webBuiltAt: text(BUILD_INFO.builtAt),
    });
  }

  // In the VE's frame the page's own platform is always "web" (the VE loads the web
  // app), so the app around the VE says what it is. Apps from before it was asked
  // don't answer: the play is then recorded as "unknown".
  private identity(play: CurrentPlay | null): Identity {
    if (play && play.embedded) {
      return this.host || { platform: "unknown", appVersion: null, appBuild: null };
    }
    return {
      platform: Capacitor.platform,
      appVersion: this.device ? this.device.appVersion : null,
      appBuild: this.device ? this.device.appBuild : null,
    };
  }

  /** The window around this one, when the app runs in a frame. */
  private hostWindow(): Window | null {
    try {
      return typeof window !== "undefined" && window.top && window.top !== window.self ? window.top : null;
    } catch {
      return null;
    }
  }

  /**
   * The language selected in the app around the VE. In the VE's frame the page has its
   * own storage, so without this it follows the device, not the player's selection.
   * Null outside the frame, and for apps from before the language was part of the answer.
   */
  async askHostLanguage(): Promise<string | null> {
    await this.askHost();
    return this.hostLanguage;
  }

  /** Asks the app around the VE what it is, and waits a moment for the answer. */
  private askHost(): Promise<void> {
    const target = this.hostWindow();
    if (this.host || !target) return Promise.resolve();
    return new Promise<void>((resolve) => {
      let timer: any;
      const done = () => {
        clearTimeout(timer);
        window.removeEventListener("message", onMessage);
        resolve();
      };
      const onMessage = (e: MessageEvent) => {
        if (e.source !== target || !e.data || e.data.type !== HOST_INFO_MESSAGE) return;
        if (!HOST_PLATFORMS.includes(e.data.platform)) return;
        this.host = {
          platform: e.data.platform,
          appVersion: text(e.data.appVersion),
          appBuild: text(e.data.appBuild),
        };
        this.hostLanguage = text(e.data.language);
        done();
      };
      window.addEventListener("message", onMessage);
      timer = setTimeout(done, this.hostWaitMs);
      target.postMessage({ type: HOST_INFO_REQUEST }, "*");
    });
  }

  private beacon(body: string) {
    const queued =
      typeof navigator !== "undefined" &&
      typeof navigator.sendBeacon === "function" &&
      navigator.sendBeacon(this.url, new Blob([body], { type: "text/plain" }));
    if (!queued) {
      this.post(body).catch(() => {});
    }
  }

  // text/plain keeps it a "simple" cross-origin request (no CORS preflight), like sendBeacon.
  private post(body: string): Promise<any> {
    return fetch(this.url, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body,
      keepalive: true,
      credentials: "omit",
    });
  }

  private async loadDevice() {
    if (this.device) return;
    try {
      const info: any = await Plugins.Device.getInfo();
      this.device = { appVersion: info.appVersion || null, appBuild: info.appBuild || null };
    } catch {
      this.device = { appVersion: null, appBuild: null };
    }
  }
}

/** The same game in the same way: a second start of the play that is running. */
function samePlay(a: PlayDescriptor, b: PlayDescriptor): boolean {
  return a.game === b.game && a.event === b.event && a.world === b.world && a.mode === b.mode;
}
