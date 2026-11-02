import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormsModule } from "@angular/forms";
import { RouterTestingModule } from "@angular/router/testing";
import { IonicModule } from "@ionic/angular";
import { TranslateModule } from "@ngx-translate/core";
import { LivePlays, PlaySessionView } from "../../../models/play-session";
import { PlaySessionAdminService } from "../../../services/play-session-admin.service";
import { LivePlaysPage } from "./live-plays.page";

describe("LivePlaysPage", () => {
  let fixture: ComponentFixture<LivePlaysPage>;
  let page: LivePlaysPage;
  let service: { fetchLive: jasmine.Spy; fetchHistory: jasmine.Spy };

  const play = (playId: string, extra: Partial<PlaySessionView> = {}): PlaySessionView => ({
    playId,
    firstSeenAt: "2026-11-02T12:00:00.000Z",
    game: { id: "64b7f0c2a1b2c3d4e5f60718", name: "Schlossplatz rally" },
    event: null,
    world: "real",
    mode: "single",
    rejoin: false,
    platform: "web",
    embedded: false,
    appVersion: null,
    appBuild: null,
    webVersion: null,
    webCommit: "abc123",
    webDeployId: null,
    webBuiltAt: null,
    startedAt: "2026-11-02T12:00:00.000Z",
    clientStartedAt: null,
    endedAt: null,
    clientEndedAt: null,
    durationMs: null,
    endReason: null,
    resumeCount: 0,
    status: "playing",
    save: null,
    uploadHttpStatus: null,
    startMissing: false,
    ...extra,
  });
  const live = (items: PlaySessionView[]): LivePlays => ({
    serverTime: "2026-11-02T12:10:00.000Z",
    counts: { playing: items.filter((p) => p.status === "playing").length, saving: 0 },
    items,
    truncated: false,
  });
  const text = () => (fixture.nativeElement.textContent || "").replace(/\s+/g, " ");
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };

  beforeEach(() => {
    service = {
      fetchLive: jasmine.createSpy("fetchLive"),
      fetchHistory: jasmine.createSpy("fetchHistory").and.returnValue(
        Promise.resolve({ serverTime: "", items: [], hasMore: false, nextCursor: null })
      ),
    };
    TestBed.configureTestingModule({
      declarations: [LivePlaysPage],
      imports: [IonicModule.forRoot(), FormsModule, TranslateModule.forRoot(), RouterTestingModule],
      providers: [{ provide: PlaySessionAdminService, useValue: service }],
      schemas: [NO_ERRORS_SCHEMA],
    });
    fixture = TestBed.createComponent(LivePlaysPage);
    page = fixture.componentInstance;
  });

  afterEach(() => page?.ionViewWillLeave());

  it("splits running plays from the rest of the day", async () => {
    service.fetchLive.and.returnValue(
      Promise.resolve(live([play("a"), play("b", { status: "finished", endReason: "finished" }), play("c", { status: "abandoned" })]))
    );
    await page.refreshLive();
    expect(page.playingNow.map((p) => p.playId)).toEqual(["a"]);
    expect(page.recent.map((p) => p.playId)).toEqual(["b", "c"]);
    expect(page.liveUpdatedAt).toBeTruthy();
    expect(page.liveFailedAt).toBeNull();
  });

  it("keeps the last data on screen when a refresh fails, and says so", async () => {
    service.fetchLive.and.returnValue(Promise.resolve(live([play("a")])));
    await page.refreshLive();
    const loadedAt = page.liveUpdatedAt;

    service.fetchLive.and.returnValue(Promise.reject(new Error("offline")));
    await page.refreshLive();
    await settle();

    expect(page.live.items.length).toBe(1);
    expect(page.liveUpdatedAt).toBe(loadedAt);
    expect(page.liveFailedAt).toBeTruthy();
    expect(text()).toContain("LivePlays.refreshFailed");
    expect(text()).toContain("Schlossplatz rally");
  });

  it("searches whole days in local time and pages with the same filters", async () => {
    service.fetchHistory.and.returnValues(
      Promise.resolve({ serverTime: "", items: [play("a")], hasMore: true, nextCursor: "cursor-1" }),
      Promise.resolve({ serverTime: "", items: [play("b")], hasMore: false, nextCursor: null })
    );
    page.filters = { ...page.filters, from: "2026-11-01", to: "2026-11-02", status: "finished" };
    page.search();
    await settle();
    const [filters, cursor] = service.fetchHistory.calls.argsFor(0);
    expect(filters.from).toBe(new Date("2026-11-01T00:00:00").toISOString());
    expect(filters.to).toBe(new Date("2026-11-02T23:59:59.999").toISOString());
    expect(filters.status).toBe("finished");
    expect(cursor).toBeUndefined();

    page.filters.status = "left"; // changed but not searched yet
    await page.loadHistory();
    expect(service.fetchHistory.calls.argsFor(1)[0].status).toBe("finished");
    expect(service.fetchHistory.calls.argsFor(1)[1]).toBe("cursor-1");
    expect(page.history.map((p) => p.playId)).toEqual(["a", "b"]);
    expect(page.historyHasMore).toBeFalse();
  });

  it("works out running time on the server's clock, not the admin's", async () => {
    // serverTime is 10 minutes after the start, whatever this device's clock says.
    service.fetchLive.and.returnValue(Promise.resolve(live([play("a")])));
    await page.refreshLive();
    expect(page.durations.get("a")).toBe("10 min");
  });

  it("lets a new search replace a \"Load more\" that is still loading", async () => {
    let releaseMore: (value: any) => void;
    service.fetchHistory.and.returnValues(
      Promise.resolve({ serverTime: "", items: [play("a")], hasMore: true, nextCursor: "cursor-1" }),
      new Promise((resolve) => (releaseMore = resolve)),
      Promise.resolve({ serverTime: "", items: [play("x")], hasMore: false, nextCursor: null })
    );
    page.search();
    await settle();

    const more = page.loadHistory();
    page.filters.status = "left";
    page.search();
    await settle();
    releaseMore({ serverTime: "", items: [play("b")], hasMore: false, nextCursor: null });
    await more;
    await settle();

    expect(service.fetchHistory.calls.count()).toBe(3);
    expect(service.fetchHistory.calls.argsFor(2)[0].status).toBe("left");
    expect(page.history.map((p) => p.playId)).toEqual(["x"]);
    expect(page.historyLoading).toBeFalse();
  });

  it("shows the platform of the app around the VE and the web release", async () => {
    service.fetchLive.and.returnValue(
      Promise.resolve(
        live([play("a", { world: "virtual", platform: "ios", embedded: true, appVersion: "4.4.0", appBuild: "18", webVersion: "6.0.1+62" })])
      )
    );
    await page.refreshLive();
    await settle();
    expect(text()).toContain("ios (LivePlays.inVeFrame) · app 4.4.0 (18) · web 6.0.1+62");
  });

  it("shows the play time measured by the app once ended", () => {
    expect(page.duration(play("a", { status: "finished", durationMs: 12 * 60 * 1000 }))).toBe("12 min");
    expect(page.duration(play("b", { status: "abandoned" }))).toBe("");
  });
});
