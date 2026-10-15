import { TestBed } from "@angular/core/testing";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { HttpClient } from "@angular/common/http";
import { Plugins } from "@capacitor/core";
import { Subject } from "rxjs";
import { environment } from "../../environments/environment";
import { TrackerService } from "./tracker.service";

// Characterization tests: they pin down what TrackerService does today so the
// framework / Capacitor upgrades can be checked against it. The native plugin
// seam is isolated in stubNativePlugins() (the only part that has to change
// when Capacitor's `Plugins` API is replaced).
describe("TrackerService", () => {
  const DEVICE = {
    model: "Pixel 7",
    platform: "android",
    operatingSystem: "android",
    osVersion: "14",
    isVirtual: false,
    appName: "GeoGami",
    appVersion: "1.0.3",
    appBuild: "42",
    appId: "de.ifgi.geogami",
    manufacturer: "Google",
    name: "Anna's Pixel", // must never be sent to the server
    uuid: "should-not-leak",
  };

  let http: HttpClient;
  let backend: HttpTestingController;
  let position$: Subject<any>;
  let heading$: Subject<number>;
  let avatarPosition$: Subject<any>;
  let avatarHeading$: Subject<number>;
  let mapHandlers: { [event: string]: (e: any) => void };
  let map: any;
  let writeFile: jasmine.Spy;

  function stubNativePlugins() {
    spyOn(Plugins.Device, "getInfo").and.returnValue(Promise.resolve(DEVICE) as any);
    spyOn(Plugins.Filesystem, "mkdir").and.returnValue(Promise.resolve() as any);
    writeFile = spyOn(Plugins.Filesystem, "writeFile").and.returnValue(Promise.resolve({ uri: "x" }) as any);
  }

  function service(): TrackerService {
    return new TrackerService(
      http,
      { geolocationSubscription: position$, avatarGeolocationSubscription: avatarPosition$ } as any,
      { orientationSubscription: heading$, avatarOrientationSubscription: avatarHeading$ } as any
    );
  }

  const pos = (lat: number, lng: number) => ({ coords: { latitude: lat, longitude: lng } });

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    position$ = new Subject();
    heading$ = new Subject();
    avatarPosition$ = new Subject();
    avatarHeading$ = new Subject();
    mapHandlers = {};
    map = {
      on: (event: string, handler: (e: any) => void) => (mapHandlers[event] = handler),
      getBounds: () => "bounds",
      getCenter: () => "center",
      getZoom: () => 15,
      getBearing: () => 90,
      getPitch: () => 10,
    };
    localStorage.removeItem("bg_accesstoken");
    stubNativePlugins();
  });

  afterEach(() => {
    localStorage.removeItem("bg_accesstoken");
    backend.verify();
  });

  async function started(opts: { virtual?: boolean; single?: boolean; numPlayers?: number; playerNo?: number } = {}) {
    const tracker = service();
    await tracker.init(
      "game-1",
      "My Game",
      map,
      ["Alice"],
      !!opts.virtual,
      { lat: 51.9, lng: 7.6 },
      opts.single !== false,
      opts.numPlayers || 1,
      opts.playerNo || 1,
      "instructor-1",
      "event-1"
    );
    return tracker;
  }

  describe("waypoints", () => {
    it("starts empty and records the latest real-world position with map, compass and task context", async () => {
      const tracker = await started();
      expect(tracker.getWaypoints()).toEqual([]);
      expect(tracker.getEvents()).toEqual([]);

      position$.next(pos(51.9, 7.6));
      heading$.next(120);
      tracker.updateTaskNo(3, "nav");
      tracker.addWaypoint({ custom: "field" });

      const [waypoint] = tracker.getWaypoints();
      expect(waypoint.custom).toBe("field");
      expect(waypoint.position).toEqual(pos(51.9, 7.6) as any);
      expect(waypoint.compassHeading).toBe(120);
      expect(waypoint.taskNo).toBe(3);
      expect(waypoint.taskCategory).toBe("nav");
      expect(waypoint.mapViewport).toEqual({ bounds: "bounds", center: "center", zoom: 15, bearing: 90, pitch: 10 });
      expect(new Date(waypoint.timestamp).toISOString()).toBe(waypoint.timestamp);
    });

    it("prefers an explicitly passed position over the subscribed one", async () => {
      const tracker = await started();
      position$.next(pos(1, 1));
      tracker.addWaypoint({}, pos(2, 2));
      expect(tracker.getWaypoints()[0].position).toEqual(pos(2, 2) as any);
    });

    it("does not record while paused and records again after resume", async () => {
      const tracker = await started();
      tracker.pauseWaypointRecording();
      tracker.addWaypoint({});
      expect(tracker.getWaypoints().length).toBe(0);
      tracker.resumeWaypointRecording();
      tracker.addWaypoint({});
      expect(tracker.getWaypoints().length).toBe(1);
    });

    it("ignores waypoints before init()", () => {
      const tracker = service();
      expect(() => tracker.addWaypoint({})).not.toThrow();
      expect(tracker.getWaypoints()).toBeUndefined();
    });

    it("can be restored from stored waypoints and events", async () => {
      const tracker = await started();
      tracker.setWaypoints([{ a: 1 }]);
      tracker.setEvents([{ b: 2 }]);
      expect(tracker.getWaypoints()).toEqual([{ a: 1 }]);
      expect(tracker.getEvents()).toEqual([{ b: 2 }]);
    });
  });

  describe("interaction counters", () => {
    it("counts user-initiated pans only, and halves the zoomend count", async () => {
      const tracker = await started();
      mapHandlers.moveend({ type: "moveend", originalEvent: {} }); // user pan
      mapHandlers.moveend({ type: "moveend" }); // programmatic move
      mapHandlers.zoomend({ type: "zoomend", originalEvent: {} });
      mapHandlers.zoomend({ type: "zoomend", originalEvent: {} });
      mapHandlers.zoomend({ type: "zoomend" }); // programmatic zoom
      tracker.addWaypoint({});
      expect(tracker.getWaypoints()[0].interaction).toEqual({ panCount: 1, zoomCount: 1, rotation: 0 });
    });

    it("accumulates compass rotation only for changes above 15 degrees, across the 0/360 wrap", async () => {
      const tracker = await started();
      heading$.next(350); // first heading is the reference
      heading$.next(355); // +5: ignored
      heading$.next(10); // 20 from 350 across north: counted
      tracker.addWaypoint({});
      expect(tracker.getWaypoints()[0].interaction.rotation).toBe(20);
      expect(tracker.getWaypoints()[0].compassHeading).toBe(10);
    });

    it("resets the counters when a new task is set", async () => {
      const tracker = await started();
      mapHandlers.moveend({ type: "moveend", originalEvent: {} });
      tracker.setTask({ id: "t2" });
      tracker.addWaypoint({});
      expect(tracker.getWaypoints()[0].interaction).toEqual({ panCount: 0, zoomCount: 0, rotation: 0 });
    });
  });

  describe("events", () => {
    it("records the current task and uses rotationCount (not rotation) for events", async () => {
      const tracker = await started();
      tracker.setTask({ id: "t1" });
      position$.next(pos(5, 6));
      tracker.addEvent({ type: "answer" });
      const [event] = tracker.getEvents();
      expect(event.type).toBe("answer");
      expect(event.task).toEqual({ id: "t1" });
      expect(event.position).toEqual(pos(5, 6) as any);
      expect(event.interaction).toEqual({ panCount: 0, zoomCount: 0, rotationCount: 0 });
    });
  });

  describe("virtual world", () => {
    it("uses the initial avatar location first, then converts avatar x/z to coordinates", async () => {
      const tracker = await started({ virtual: true });
      avatarPosition$.next({ x: "0", z: "0" });
      tracker.addWaypoint({});
      expect({ ...tracker.getWaypoints()[0].position.coords }).toEqual({ latitude: 51.9, longitude: 7.6 });

      avatarPosition$.next({ x: "111000", z: "224000" });
      tracker.addWaypoint({});
      // avatar z becomes latitude (z / 112000) and x becomes longitude (x / 111000)
      expect({ ...tracker.getWaypoints()[1].position.coords }).toEqual({ latitude: 2, longitude: 1 });
    });

    it("takes the compass heading from the avatar orientation, not the device", async () => {
      const tracker = await started({ virtual: true });
      avatarHeading$.next(45);
      heading$.next(200);
      tracker.addWaypoint({}, null);
      expect(tracker.getWaypoints()[0].compassHeading).toBe(45);
    });
  });

  describe("device info", () => {
    it("whitelists fields and never includes the device name or uuid", () => {
      const info = service().getDeviceInfo(DEVICE);
      expect(info).toEqual({
        model: "Pixel 7",
        platform: "android",
        operatingSystem: "android",
        osVersion: "14",
        isVirtual: false,
        appName: "GeoGami",
        appVersion: "1.0.3",
        appBuild: "42",
        appId: "de.ifgi.geogami",
        device_manufacturer: "Google",
      });
      expect(JSON.stringify(info)).not.toContain("Anna");
      expect(JSON.stringify(info)).not.toContain("should-not-leak");
    });
  });

  describe("uploadTrack", () => {
    it("posts a single-player track with auth headers and stops listening to sensors", async () => {
      localStorage.setItem("bg_accesstoken", "tok");
      const tracker = await started();
      tracker.addWaypoint({});
      tracker.addEvent({ type: "x" });

      const done = tracker.uploadTrack();
      await new Promise((resolve) => setTimeout(resolve));
      const req = backend.expectOne(`${environment.apiURL}/track`);
      expect(req.request.method).toBe("POST");
      expect(req.request.headers.get("Authorization")).toBe("Bearer tok");
      expect(req.request.headers.get("Content-Type")).toBe("application/json");

      const body = req.request.body;
      expect(body.game).toBe("game-1");
      expect(body.name).toBe("My Game");
      expect(body.instructor).toBe("instructor-1");
      expect(body.event).toBe("event-1");
      expect(body.players).toEqual(["Alice"]);
      expect(body.playersCount).toBe(1);
      expect(body.isMultiplayerGame).toBeUndefined();
      expect(body._id).toBeUndefined();
      expect(body.playerNo).toBeUndefined();
      expect(body.waypoints.length).toBe(1);
      expect(body.events.length).toBe(1);
      expect(body.device.device_manufacturer).toBe("Google");
      expect(body.device.name).toBeUndefined();
      expect(new Date(body.start).getTime()).toBeLessThanOrEqual(new Date(body.end).getTime());
      req.flush({ ok: true });
      await done;

      // the sensor subscriptions are closed, so new emissions are not recorded
      expect(position$.observers.length).toBe(0);
      expect(heading$.observers.length).toBe(0);
    });

    it("omits instructor and event when the play is not attributed to one", async () => {
      const tracker = service();
      await tracker.init("g", "n", map, ["A"], false, null, true, 1, 1);
      const done = tracker.uploadTrack();
      await new Promise((resolve) => setTimeout(resolve));
      const req = backend.expectOne(`${environment.apiURL}/track`);
      expect(req.request.body.instructor).toBeUndefined();
      expect(req.request.body.event).toBeUndefined();
      req.flush({});
      await done;
    });

    it("sends no Authorization header when nobody is logged in", async () => {
      const tracker = await started();
      const done = tracker.uploadTrack();
      await new Promise((resolve) => setTimeout(resolve));
      const req = backend.expectOne(`${environment.apiURL}/track`);
      expect(req.request.headers.has("Authorization")).toBe(false);
      req.flush({});
      await done;
    });

    it("keeps a local copy named after the game (spaces replaced) and the start time", async () => {
      const tracker = await started();
      const done = tracker.uploadTrack();
      await new Promise((resolve) => setTimeout(resolve));
      const file = writeFile.calls.mostRecent().args[0];
      expect(file.path).toMatch(/^origami\/tracks\/My_Game-.+\.json$/);
      expect(JSON.parse(file.data).game).toBe("game-1");
      backend.expectOne(`${environment.apiURL}/track`).flush({});
      await done;
    });

    it("still uploads when the local copy cannot be written", async () => {
      writeFile.and.returnValue(Promise.reject(new Error("disk full")));
      const tracker = await started();
      const done = tracker.uploadTrack();
      await new Promise((resolve) => setTimeout(resolve));
      backend.expectOne(`${environment.apiURL}/track`).flush({});
      await done;
    });

    it("puts only this player's slot into per-player arrays for a new multiplayer track", async () => {
      const tracker = await started({ single: false, numPlayers: 3, playerNo: 2 });
      tracker.addWaypoint({});
      const done = tracker.uploadTrack(false);
      await new Promise((resolve) => setTimeout(resolve));
      const req = backend.expectOne(`${environment.apiURL}/track`);
      expect(req.request.method).toBe("POST");
      const body = req.request.body;
      expect(body.isMultiplayerGame).toBe(true);
      expect(body.playersCount).toBe(3);
      expect(body.players.length).toBe(3);
      expect(body.players[1]).toBe("Alice");
      expect(body.players[0]).toBeUndefined();
      expect(body.waypoints[1].length).toBe(1);
      expect(body.waypoints[0]).toBeUndefined();
      expect(body.device[1].model).toBe("Pixel 7");
      req.flush({});
      await done;
    });

    it("updates the existing multiplayer track with PUT, sending the track id and player number", async () => {
      const tracker = await started({ single: false, numPlayers: 3, playerNo: 3 });
      const done = tracker.uploadTrack(true, "track-9");
      await new Promise((resolve) => setTimeout(resolve));
      const req = backend.expectOne(`${environment.apiURL}/track`);
      expect(req.request.method).toBe("PUT");
      expect(req.request.body._id).toBe("track-9");
      expect(req.request.body.playerNo).toBe(3);
      expect(req.request.body.players).toEqual(["Alice"]);
      req.flush({});
      await done;
    });

    it("propagates a server error to the caller", async () => {
      const tracker = await started();
      const done = tracker.uploadTrack();
      await new Promise((resolve) => setTimeout(resolve));
      backend.expectOne(`${environment.apiURL}/track`).flush({ msg: "no" }, { status: 500, statusText: "Server Error" });
      await expectAsync(done).toBeRejected();
    });
  });

  describe("reading tracks", () => {
    it("requests the tracks of a game and a single track by id", async () => {
      localStorage.setItem("bg_accesstoken", "tok");
      const tracker = service();
      const games = tracker.getGameTracks("g1");
      const gamesReq = backend.expectOne(`${environment.apiURL}/track/gametracks/g1`);
      expect(gamesReq.request.method).toBe("GET");
      expect(gamesReq.request.headers.get("Authorization")).toBe("Bearer tok");
      gamesReq.flush([{ _id: "t1" }]);
      expect(await games).toEqual([{ _id: "t1" }]);

      const single = tracker.getGameTrackById("t1");
      backend.expectOne(`${environment.apiURL}/track/t1`).flush({ _id: "t1" });
      expect(await single).toEqual({ _id: "t1" });
    });
  });

  describe("clear", () => {
    it("closes the sensor subscriptions", async () => {
      const tracker = await started();
      tracker.clear();
      expect(position$.observers.length).toBe(0);
      expect(heading$.observers.length).toBe(0);
    });
  });
});
