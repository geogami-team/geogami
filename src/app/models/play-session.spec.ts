import {
  LIVE_PLAYS_ROLES,
  buildDiagnostics,
  formatDuration,
  newPlayId,
  parseLivePlays,
  parsePlayHistory,
} from "./play-session";

describe("play-session model", () => {
  it("is for admins only", () => {
    expect(LIVE_PLAYS_ROLES).toEqual(["admin"]);
  });

  it("formats play times", () => {
    expect(formatDuration(45 * 1000)).toBe("45 s");
    expect(formatDuration(12 * 60 * 1000)).toBe("12 min");
    expect(formatDuration(65 * 60 * 1000)).toBe("1 h 05 min");
    expect(formatDuration(null)).toBe("");
    expect(formatDuration(-1)).toBe("");
  });

  it("makes v4 UUIDs, also where crypto.randomUUID is missing", () => {
    const v4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    expect(newPlayId()).toMatch(/^[0-9a-f-]{36}$/);
    expect(newPlayId({ getRandomValues: (a: Uint8Array) => crypto.getRandomValues(a) })).toMatch(v4);
    expect(newPlayId(null)).toMatch(v4);
    expect(newPlayId(null)).not.toBe(newPlayId(null));
  });

  it("builds diagnostic details without a player name", () => {
    const text = buildDiagnostics({
      playId: "3f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f",
      gameId: "64b7f0c2a1b2c3d4e5f60718",
      gameName: "Aasee walk",
      world: "virtual",
      mode: "multi",
      taskNo: 2,
      tasksCount: 5,
      startedAt: new Date("2026-11-02T12:00:00Z"),
      platform: "web",
      embedded: false,
      appVersion: null,
      appBuild: null,
      webVersion: null,
      webCommit: "abc123",
      webDeployId: "d1",
      webBuiltAt: null,
    });
    expect(text.split("\n")).toEqual([
      "GeoGami diagnostic details",
      "Play ID: 3f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f",
      "Game: Aasee walk (64b7f0c2a1b2c3d4e5f60718)",
      "Type: virtual environment, multiplayer",
      "Task: 2 of 5",
      "Started: 2026-11-02T12:00:00.000Z",
      "Platform: web",
      "Web build: abc123 (deploy d1)",
    ]);
  });

  it("names the release and the app around the VE in the diagnostic details", () => {
    const text = buildDiagnostics({
      playId: "3f2b8c1e-5d4a-4b7e-9c2d-1a2b3c4d5e6f",
      gameId: null,
      gameName: null,
      world: "virtual",
      mode: "single",
      taskNo: null,
      tasksCount: null,
      startedAt: null,
      platform: "ios",
      embedded: true,
      appVersion: "4.4.0",
      appBuild: "18",
      webVersion: "6.0.1+62",
      webCommit: "abc123",
      webDeployId: null,
      webBuiltAt: null,
    });
    expect(text).toContain("Platform: ios (game in the VE frame)");
    expect(text).toContain("Web build: 6.0.1+62, commit abc123");
    expect(text).toContain("App: 4.4.0 (build 18)");
  });

  it("rejects answers that are not live plays or history pages", () => {
    expect(parseLivePlays(null)).toBeNull();
    expect(parseLivePlays({ items: [] })).toBeNull();
    expect(parseLivePlays({ counts: { playing: "2" }, items: [] }).counts).toEqual({ playing: 2, saving: 0 });
    expect(parsePlayHistory({})).toBeNull();
    expect(parsePlayHistory({ items: [], hasMore: true, nextCursor: "x" }).nextCursor).toBe("x");
  });
});
