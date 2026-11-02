import { Component, OnDestroy } from "@angular/core";
import {
  LivePlays,
  PLAY_STATUSES,
  PlayHistoryFilters,
  PlaySessionView,
  SAVE_COLOR,
  SAVE_STATUSES,
  STATUS_COLOR,
  formatDuration,
  shortId,
} from "src/app/models/play-session";
import { PlaySessionAdminService } from "src/app/services/play-session-admin.service";

// The "Now" tab reloads itself this often while it is open and visible.
export const LIVE_REFRESH_MS = 30 * 1000;

const emptyFilters = (): PlayHistoryFilters => ({
  from: "",
  to: "",
  game: "",
  event: "",
  status: "",
  save: "",
  playId: "",
});

/**
 * "Live plays": which games are being played right now, and the history of plays,
 * from the start/end messages the app sends (PlaySessionService).
 *
 * A failed refresh never empties the page: what was loaded stays on screen, with
 * the time it was loaded and the time the refresh failed, so it cannot be mistaken
 * for "nobody is playing".
 */
@Component({
  selector: "app-live-plays",
  templateUrl: "./live-plays.page.html",
  styleUrls: ["./live-plays.page.scss"],
})
export class LivePlaysPage implements OnDestroy {
  tab: "now" | "history" = "now";

  live: LivePlays | null = null;
  /** The live plays split once per load, not on every change detection. */
  playingNow: PlaySessionView[] = [];
  recent: PlaySessionView[] = [];
  liveLoading = false;
  /** Device time of the last successful load, and of a refresh that failed after it. */
  liveUpdatedAt: Date | null = null;
  liveFailedAt: Date | null = null;

  filters: PlayHistoryFilters = emptyFilters();
  history: PlaySessionView[] = [];
  historyLoaded = false;
  historyLoading = false;
  historyHasMore = false;
  historyUpdatedAt: Date | null = null;
  historyFailedAt: Date | null = null;
  private historyCursor: string | null = null;
  /** The filters the shown history was loaded with ("Load more" keeps using them). */
  private historyFilters: PlayHistoryFilters = emptyFilters();
  /** Counts history requests: only the newest one may change the list. */
  private historyRequest = 0;

  expanded = new Set<string>();
  /** Play time per play id, worked out when the data arrives. */
  durations = new Map<string, string>();
  /** Server clock minus this device's clock, so a wrong admin clock doesn't change "running for". */
  private clockOffsetMs = 0;

  readonly statuses = PLAY_STATUSES;
  readonly saveStatuses = SAVE_STATUSES;
  readonly statusColor = STATUS_COLOR;
  readonly saveColor = SAVE_COLOR;
  readonly shortId = shortId;

  private timer: any = null;

  constructor(private plays: PlaySessionAdminService) {}

  ionViewDidEnter() {
    this.refreshLive();
    this.stopTimer();
    this.timer = setInterval(() => {
      if (this.tab === "now" && !document.hidden) this.refreshLive();
    }, LIVE_REFRESH_MS);
  }

  ionViewWillLeave() {
    this.stopTimer();
  }

  ngOnDestroy() {
    this.stopTimer();
  }

  private stopTimer() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  onTabChange() {
    if (this.tab === "now") this.refreshLive();
    if (this.tab === "history" && !this.historyLoaded) this.search();
  }

  async refreshLive() {
    if (this.liveLoading) return;
    this.liveLoading = true;
    try {
      const live = await this.plays.fetchLive();
      this.setServerClock(live.serverTime);
      this.noteDurations(live.items);
      this.live = live;
      this.playingNow = live.items.filter((p) => p.status === "playing");
      this.recent = live.items.filter((p) => p.status !== "playing");
      this.liveUpdatedAt = new Date();
      this.liveFailedAt = null;
    } catch {
      this.liveFailedAt = new Date();
    } finally {
      this.liveLoading = false;
    }
  }

  /** A new search with the filters as they are now. */
  search() {
    this.historyFilters = this.queryFilters(this.filters);
    this.historyCursor = null;
    this.loadHistory(true);
  }

  clearFilters() {
    this.filters = emptyFilters();
    this.search();
  }

  /** A new search replaces a request still loading; "Load more" waits for it. */
  async loadHistory(fresh = false) {
    if (this.historyLoading && !fresh) return;
    const request = ++this.historyRequest;
    this.historyLoading = true;
    try {
      const page = await this.plays.fetchHistory(this.historyFilters, fresh ? undefined : this.historyCursor);
      if (request !== this.historyRequest) return;
      this.setServerClock(page.serverTime);
      this.noteDurations(page.items);
      this.history = fresh ? page.items : this.history.concat(page.items);
      this.historyHasMore = page.hasMore;
      this.historyCursor = page.nextCursor;
      this.historyLoaded = true;
      this.historyUpdatedAt = new Date();
      this.historyFailedAt = null;
    } catch {
      if (request === this.historyRequest) this.historyFailedAt = new Date();
    } finally {
      if (request === this.historyRequest) this.historyLoading = false;
    }
  }

  /** Date inputs give a day; the search covers that whole day in local time. */
  private queryFilters(filters: PlayHistoryFilters): PlayHistoryFilters {
    const day = (value: string, time: string) => {
      if (!value) return "";
      const date = new Date(`${value}T${time}`);
      return isNaN(date.getTime()) ? "" : date.toISOString();
    };
    return {
      ...filters,
      from: day(filters.from, "00:00:00"),
      to: day(filters.to, "23:59:59.999"),
    };
  }

  toggle(playId: string) {
    if (this.expanded.has(playId)) this.expanded.delete(playId);
    else this.expanded.add(playId);
  }

  /** Play time: measured by the app once ended, the time since the start (server clock) while running. */
  duration(p: PlaySessionView): string {
    if (p.durationMs != null) return formatDuration(p.durationMs);
    if (p.status !== "playing") return "";
    const start = new Date(p.startedAt || p.firstSeenAt).getTime();
    return formatDuration(Date.now() + this.clockOffsetMs - start);
  }

  private noteDurations(items: PlaySessionView[]) {
    for (const p of items) this.durations.set(p.playId, this.duration(p));
  }

  private setServerClock(serverTime: string) {
    const server = Date.parse(serverTime);
    if (!isNaN(server)) this.clockOffsetMs = server - Date.now();
  }

  /** The yellow "warning" badge needs dark text to be readable. */
  darkText(color: string): boolean {
    return color === "warning" || color === "light";
  }

  trackByPlay(index: number, p: PlaySessionView) {
    return p.playId;
  }
}
