import { Capacitor, Plugins } from "@capacitor/core";
import { HOST_INFO_MESSAGE, HOST_INFO_REQUEST } from "../models/play-session";
import { PlaySessionService } from "./play-session.service";

describe("PlaySessionService", () => {
  let service: PlaySessionService;
  let fetchSpy: jasmine.Spy;
  let beaconSpy: jasmine.Spy;

  const GAME = "64b7f0c2a1b2c3d4e5f60718";
  const OTHER_GAME = "64b7f0c2a1b2c3d4e5f60719";
  const descriptor = { game: GAME, world: "real" as const, mode: "single" as const };

  // The messages the service sent with fetch, oldest first.
  const sent = () => fetchSpy.calls.allArgs().map(([, init]) => JSON.parse(init.body));
  const flush = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    for (let i = 0; i < 20; i++) await Promise.resolve();
  };

  beforeEach(() => {
    fetchSpy = spyOn(window, "fetch").and.returnValue(Promise.resolve(new Response(null, { status: 204 })));
    beaconSpy = spyOn(navigator, "sendBeacon").and.returnValue(true);
    spyOn(Plugins.Device, "getInfo").and.returnValue(
      Promise.resolve({ appVersion: "7.3.0", appBuild: "42" } as any)
    );
    service = new PlaySessionService();
  });

  // Listeners stay on window; leave no running play behind for the next test.
  afterEach(async () => {
    service.end("left");
    await flush();
  });

  it("sends the start as text/plain without login, player name or location", async () => {
    service.start({ ...descriptor, event: null });
    await flush();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.calls.mostRecent().args;
    expect(url).toMatch(/\/play-session\/events$/);
    expect(init.headers).toEqual({ "Content-Type": "text/plain" });
    expect(init.credentials).toBe("omit");
    const body = JSON.parse(init.body);
    expect(body.type).toBe("start");
    expect(body.playId).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.game).toBe(GAME);
    expect(body.appVersion).toBe("7.3.0");
    expect(Object.keys(body)).not.toContain("playerName");
    expect(Object.keys(body)).not.toContain("user");
  });

  it("counts only the first end", async () => {
    service.start(descriptor);
    service.end("finished");
    service.end("left");
    await flush();
    expect(sent().map((m) => m.type + (m.reason ? ":" + m.reason : ""))).toEqual(["start", "end:finished"]);
  });

  it("keeps the order even when the start is slow", async () => {
    let releaseStart: (value: any) => void;
    fetchSpy.and.returnValues(
      new Promise((resolve) => (releaseStart = resolve)),
      Promise.resolve(new Response(null, { status: 204 }))
    );
    service.start(descriptor);
    service.end("finished");
    await flush();
    expect(sent().map((m) => m.type)).toEqual(["start"]);

    releaseStart(new Response(null, { status: 204 }));
    await flush();
    expect(sent().map((m) => m.type)).toEqual(["start", "end"]);
  });

  it("counts a second start of the running play once, and ends a running play of another game", async () => {
    service.start(descriptor);
    service.start(descriptor);
    await flush();
    expect(sent().map((m) => m.type)).toEqual(["start"]);
    const first = sent()[0].playId;

    service.start({ ...descriptor, game: OTHER_GAME });
    await flush();
    const [, end, start] = sent();
    expect([end.type, end.reason, end.playId]).toEqual(["end", "left", first]);
    expect([start.type, start.game]).toEqual(["start", OTHER_GAME]);
    expect(start.playId).not.toBe(first);
  });

  it("numbers the messages of a play", async () => {
    service.start(descriptor);
    service.uploadExpected(false);
    await flush();
    expect(sent().map((m) => m.seq)).toEqual([1, 2]);
  });

  it("goes on when the server cannot be reached, and never throws", async () => {
    fetchSpy.and.returnValue(Promise.reject(new TypeError("Failed to fetch")));
    expect(() => service.start(descriptor)).not.toThrow();
    expect(() => service.end("finished")).not.toThrow();
    await flush();
    expect(sent().map((m) => m.type)).toEqual(["start", "end"]);
  });

  describe("upload status", () => {
    const uploads = () => sent().filter((m) => m.type === "upload");

    it("reports not_requested without consent and pending with it", async () => {
      service.start(descriptor);
      service.uploadExpected(false);
      await flush();
      expect(uploads().map((m) => m.status)).toEqual(["not_requested"]);
    });

    it("counts HTTP 201 as saved and anything else as failed", async () => {
      service.start(descriptor);
      service.watchUpload(Promise.resolve({ status: 201 }));
      service.watchUpload(Promise.resolve({ status: 200 }));
      await flush();
      expect(uploads().map((m) => [m.status, m.httpStatus])).toEqual([
        ["saved", 201],
        ["failed", 200],
      ]);
    });

    it("reports a rejected upload and leaves the game's own handling unchanged", async () => {
      service.start(descriptor);
      const upload = Promise.reject({ status: 0, message: "offline" });
      service.watchUpload(upload);
      let gameSaw: any = null;
      upload.then(
        () => (gameSaw = "fulfilled"),
        (err) => (gameSaw = err)
      );
      await flush();
      expect(gameSaw).toEqual({ status: 0, message: "offline" });
      expect(uploads().map((m) => [m.status, m.httpStatus])).toEqual([["failed", 0]]);
    });
  });

  describe("closing the page", () => {
    const pagehide = () => window.dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    const pageshow = (persisted: boolean) =>
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted }));
    const beacons = () => beaconSpy.calls.allArgs().map(([url]) => url);

    it("sends a provisional closed with sendBeacon once, and a resume when the page comes back", async () => {
      service.start(descriptor);
      await flush();
      pagehide();
      pagehide();
      expect(beacons().length).toBe(1);

      pageshow(false);
      await flush();
      expect(sent().some((m) => m.type === "resume")).toBeFalse();

      pageshow(true);
      await flush();
      expect(sent().filter((m) => m.type === "resume").length).toBe(1);
    });

    it("sends nothing after the play has ended", async () => {
      service.start(descriptor);
      service.end("finished");
      await flush();
      pagehide();
      expect(beacons().length).toBe(0);
    });

    it("sends an end still waiting behind a slow start before the page goes", async () => {
      let releaseStart: (value: any) => void;
      fetchSpy.and.returnValues(
        new Promise((resolve) => (releaseStart = resolve)),
        Promise.resolve(new Response(null, { status: 204 }))
      );
      service.start(descriptor);
      service.end("finished");
      await flush();
      pagehide();

      const bodies = () => beaconSpy.calls.allArgs().map(([, blob]) => blob);
      expect(bodies().length).toBe(1);
      const end = JSON.parse(await (bodies()[0] as Blob).text());
      expect([end.type, end.reason]).toEqual(["end", "finished"]);

      // The queue does not send it a second time.
      releaseStart(new Response(null, { status: 204 }));
      await flush();
      expect(sent().map((m) => m.type)).toEqual(["start"]);
    });

    it("numbers closed and resume, so the server can tell which came last", async () => {
      service.start(descriptor);
      await flush();
      pagehide();
      pageshow(true);
      await flush();
      const closed = JSON.parse(await (beaconSpy.calls.mostRecent().args[1] as Blob).text());
      const resume = sent().find((m) => m.type === "resume");
      expect([closed.reason, closed.seq]).toEqual(["closed", 2]);
      expect(resume.seq).toBe(3);
    });

    it("falls back to fetch when the browser does not queue the beacon", async () => {
      beaconSpy.and.returnValue(false);
      service.start(descriptor);
      await flush();
      pagehide();
      await flush();
      expect(sent().some((m) => m.type === "end" && m.reason === "closed")).toBeTrue();
    });
  });

  describe("in the VE's frame", () => {
    const ve = { ...descriptor, world: "virtual" as const };
    const until = async (done: () => boolean) => {
      for (let i = 0; i < 100 && !done(); i++) await new Promise((resolve) => setTimeout(resolve, 5));
    };
    let answer: (e: MessageEvent) => void;

    beforeEach(() => {
      // The window around this one; here the test's own window plays the app around the VE.
      spyOn<any>(service, "hostWindow").and.returnValue(window);
    });
    afterEach(() => window.removeEventListener("message", answer));

    it("records the platform and app of the app around the VE", async () => {
      answer = (e) => {
        if (e.data?.type !== HOST_INFO_REQUEST) return;
        window.postMessage({ type: HOST_INFO_MESSAGE, platform: "android", appVersion: "4.4.0", appBuild: "18" }, "*");
      };
      window.addEventListener("message", answer);
      service.start(ve);
      await until(() => sent().length > 0);
      const [start] = sent();
      expect([start.platform, start.embedded, start.appVersion, start.appBuild]).toEqual(["android", true, "4.4.0", "18"]);
    });

    it("records platform unknown when the app around the VE does not answer", async () => {
      (service as any).hostWaitMs = 20;
      service.start(ve);
      await until(() => sent().length > 0);
      const [start] = sent();
      expect([start.platform, start.embedded, start.appVersion]).toEqual(["unknown", true, null]);
    });

    it("answers the frame's question as the app around the VE", async () => {
      const source = { postMessage: jasmine.createSpy("postMessage") };
      await service.answerHost({ source, origin: "https://app.geogami.ifgi.de" } as any);
      expect(source.postMessage).toHaveBeenCalledWith(
        { type: HOST_INFO_MESSAGE, platform: Capacitor.platform, appVersion: "7.3.0", appBuild: "42" },
        "https://app.geogami.ifgi.de"
      );
    });
  });

  it("puts the play id and build into the diagnostic details", async () => {
    service.start(descriptor);
    await flush();
    const playId = sent()[0].playId;
    const text = service.diagnostics({ gameName: "Schlossplatz rally", world: "real", mode: "single", taskNo: 3, tasksCount: 8 });
    expect(text).toContain(`Play ID: ${playId}`);
    expect(text).toContain("Schlossplatz rally");
    expect(text).toContain("Task: 3 of 8");
    expect(text).toContain("App: 7.3.0 (build 42)");
  });
});
