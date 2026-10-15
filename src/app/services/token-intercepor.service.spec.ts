import { TestBed } from "@angular/core/testing";
import { HTTP_INTERCEPTORS, HttpClient } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { BehaviorSubject, Observable, throwError } from "rxjs";
import { AuthService } from "./auth-service.service";
import { TokenInterceptor } from "./token-intercepor.service";

// Characterization tests for the refresh-on-403 behaviour. Note the interceptor
// only reacts to 403 (not 401) and, on retry, sets the raw token as the
// Authorization header (no "Bearer " prefix) — the API accepts both forms.
describe("TokenInterceptor", () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let auth: any;
  let refreshInProgress$: BehaviorSubject<boolean>;
  let accessToken: string | null;

  beforeEach(() => {
    accessToken = "old-token";
    refreshInProgress$ = new BehaviorSubject<boolean>(false);
    auth = {
      getRefreshTokenInProgress: () => refreshInProgress$.asObservable(),
      getAccessToken: () => accessToken,
      logout: jasmine.createSpy("logout"),
      refreshAccessToken: jasmine.createSpy("refreshAccessToken"),
    };
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: HTTP_INTERCEPTORS, useClass: TokenInterceptor, multi: true },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  const refreshReturns = (newToken: string) =>
    auth.refreshAccessToken.and.callFake(
      () =>
        new Observable((observer) => {
          accessToken = newToken;
          observer.next("new-refresh-token");
          observer.complete();
        })
    );

  it("passes successful responses through untouched", () => {
    let body: any;
    http.get("/api/games").subscribe((b) => (body = b));
    backend.expectOne("/api/games").flush({ ok: 1 });
    expect(body).toEqual({ ok: 1 });
    expect(auth.refreshAccessToken).not.toHaveBeenCalled();
  });

  it("does not refresh for errors other than 403", () => {
    for (const status of [400, 401, 404, 500]) {
      let error: any;
      http.get("/api/games").subscribe({ error: (e) => (error = e) });
      backend.expectOne("/api/games").flush({}, { status, statusText: "x" });
      expect(error.status).toBe(status);
    }
    expect(auth.refreshAccessToken).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it("refreshes the token on 403 and retries the same request with the new token", () => {
    refreshReturns("fresh-token");
    let body: any;
    http.get("/api/games").subscribe((b) => (body = b));

    backend.expectOne("/api/games").flush({}, { status: 403, statusText: "Forbidden" });
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);

    const retry = backend.expectOne("/api/games");
    expect(retry.request.headers.get("Authorization")).toBe("fresh-token");
    retry.flush({ ok: 1 });
    expect(body).toEqual({ ok: 1 });
    expect(auth.logout).not.toHaveBeenCalled();
  });

  it("retries a POST with its body intact", () => {
    refreshReturns("fresh-token");
    http.post("/api/track", { a: 1 }).subscribe();
    backend.expectOne("/api/track").flush({}, { status: 403, statusText: "x" });
    const retry = backend.expectOne("/api/track");
    expect(retry.request.method).toBe("POST");
    expect(retry.request.body).toEqual({ a: 1 });
    retry.flush({});
  });

  it("logs out and surfaces the original error when the refresh fails", () => {
    auth.refreshAccessToken.and.returnValue(throwError({ error: "Error" }));
    let error: any;
    http.get("/api/games").subscribe({ error: (e) => (error = e) });
    backend.expectOne("/api/games").flush({}, { status: 403, statusText: "Forbidden" });
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(error.status).toBe(403);
  });

  it("logs out when the refresh call itself is rejected, without trying to refresh again", () => {
    let error: any;
    http.post("/user/refresh-auth", {}).subscribe({ error: (e) => (error = e) });
    backend.expectOne("/user/refresh-auth").flush({}, { status: 403, statusText: "x" });
    expect(auth.logout).toHaveBeenCalledTimes(1);
    expect(auth.refreshAccessToken).not.toHaveBeenCalled();
    expect(error.status).toBe(403);
  });

  it("never refreshes for authenticate calls", () => {
    let error: any;
    http.post("/api/authenticate", {}).subscribe({ error: (e) => (error = e) });
    backend.expectOne("/api/authenticate").flush({}, { status: 403, statusText: "x" });
    expect(auth.refreshAccessToken).not.toHaveBeenCalled();
    expect(auth.logout).not.toHaveBeenCalled();
    expect(error.status).toBe(403);
  });

  it("retries without an Authorization header when no token is available after the refresh", () => {
    auth.refreshAccessToken.and.callFake(
      () =>
        new Observable((observer) => {
          accessToken = null;
          observer.next("r");
          observer.complete();
        })
    );
    http.get("/api/games").subscribe();
    backend.expectOne("/api/games").flush({}, { status: 403, statusText: "x" });
    const retry = backend.expectOne("/api/games");
    expect(retry.request.headers.has("Authorization")).toBe(false);
    retry.flush({});
  });
});
