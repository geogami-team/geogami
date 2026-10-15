import { TestBed } from "@angular/core/testing";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { HttpClient } from "@angular/common/http";
import { environment } from "../../environments/environment";
import { AuthService } from "./auth-service.service";

// Characterization tests for the session handling the API relies on: login,
// token storage, session recovery/refresh, logout and the Authorization header.
describe("AuthService", () => {
  const API = environment.apiURL;
  let backend: HttpTestingController;
  let router: jasmine.SpyObj<any>;
  let util: jasmine.SpyObj<any>;
  let language: jasmine.SpyObj<any>;
  let auth: AuthService;

  const clearTokens = () => {
    localStorage.removeItem("bg_accesstoken");
    localStorage.removeItem("bg_refreshtoken");
  };

  beforeEach(() => {
    clearTokens();
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    backend = TestBed.inject(HttpTestingController);
    router = jasmine.createSpyObj("Router", ["navigate"]);
    util = jasmine.createSpyObj("UtilService", ["showToast"]);
    language = jasmine.createSpyObj("LanguageService", ["applyUserLanguage"]);
    auth = new AuthService(TestBed.inject(HttpClient), router, util, language);
  });

  afterEach(() => {
    clearTokens();
    backend.verify();
  });

  describe("login", () => {
    const creds = { email: "a@b.de", password: "pw" };
    const user = { _id: "u1", roles: ["user"], language: "de", emailIsConfirmed: true };

    it("stores the user and both tokens, applies the account language and goes home", () => {
      const loading: boolean[] = [];
      auth.getLoading().subscribe((l) => loading.push(l));

      auth.login(creds);
      const req = backend.expectOne(`${API}/user/login`);
      expect(req.request.method).toBe("POST");
      expect(req.request.body).toEqual(creds);
      req.flush({ user, token: "access", refreshToken: "refresh" });

      expect(auth.getUserValue()).toEqual(user as any);
      expect(localStorage.getItem("bg_accesstoken")).toBe("access");
      expect(localStorage.getItem("bg_refreshtoken")).toBe("refresh");
      expect(language.applyUserLanguage).toHaveBeenCalledWith("de");
      expect(router.navigate).toHaveBeenCalledWith(["/"]);
      expect(loading).toEqual([false, true, false]);
      expect(auth.getloginPageOpenValue()).toBe(false);
    });

    it("sends accounts with an unconfirmed email to the verify-email page", () => {
      auth.login(creds);
      backend.expectOne(`${API}/user/login`).flush({ user, token: "t", refreshToken: "r", needsEmailVerification: true });
      expect(router.navigate).toHaveBeenCalledWith(["/user/verify-email"]);
    });

    it("shows the server message and stays logged out on a failed login", () => {
      auth.login(creds);
      backend.expectOne(`${API}/user/login`).flush({ message: "Wrong password" }, { status: 401, statusText: "Unauthorized" });
      expect(auth.getErrorMessageValue()).toBe("Wrong password");
      expect(auth.getLoadingValue()).toBe(false);
      expect(auth.getUserValue()).toBeNull();
      expect(localStorage.getItem("bg_accesstoken")).toBeNull();
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("clears the error message when the login page is opened or closed", () => {
      auth.login(creds);
      backend.expectOne(`${API}/user/login`).flush({ message: "bad" }, { status: 401, statusText: "x" });
      auth.setLoginPageOpen(true);
      expect(auth.getErrorMessageValue()).toBeNull();
    });
  });

  describe("register", () => {
    it("goes to the login page after a successful registration", () => {
      let registered: boolean;
      auth.getRegisterStatus().subscribe((v) => (registered = v));
      auth.register({ email: "a@b.de" });
      backend.expectOne(`${API}/user/register`).flush({ success: true });
      expect(registered).toBe(true);
      expect(router.navigate).toHaveBeenCalledWith(["/user/login"]);
      expect(auth.getLoadingValue()).toBe(false);
    });

    it("shows the server message when registration fails", () => {
      auth.register({ email: "a@b.de" });
      backend.expectOne(`${API}/user/register`).flush({ msg: "Email taken" }, { status: 400, statusText: "Bad Request" });
      expect(auth.getErrorMessageValue()).toBe("Email taken");
      expect(router.navigate).not.toHaveBeenCalled();
    });
  });

  describe("session recovery after a page reload", () => {
    it("restores the user from the refresh token and flags progress while it runs", () => {
      const progress: boolean[] = [];
      auth.getRefreshTokenInProgress().subscribe((p) => progress.push(p));

      auth.recoverSession("stored-refresh");
      const req = backend.expectOne(`${API}/user/refresh-auth`);
      expect(req.request.body).toEqual({ token: "stored-refresh" });
      expect(auth.getRefreshTokenInProgressValue()).toBe(true);
      req.flush({ data: { user: { _id: "u1", emailIsConfirmed: true } }, token: "a2", refreshToken: "r2" });

      expect(auth.getUserValue()).toEqual({ _id: "u1", emailIsConfirmed: true } as any);
      expect(localStorage.getItem("bg_accesstoken")).toBe("a2");
      expect(localStorage.getItem("bg_refreshtoken")).toBe("r2");
      expect(progress).toEqual([false, true, false]);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("redirects a restored but unconfirmed account to verify-email without stacking history", () => {
      auth.recoverSession("r");
      backend.expectOne(`${API}/user/refresh-auth`).flush({ data: { user: { emailIsConfirmed: false } }, token: "a", refreshToken: "r" });
      expect(router.navigate).toHaveBeenCalledWith(["/user/verify-email"], { replaceUrl: true });
    });

    it("gives up quietly when the refresh token is rejected", () => {
      auth.recoverSession("old");
      backend.expectOne(`${API}/user/refresh-auth`).flush({ message: "expired" }, { status: 401, statusText: "x" });
      expect(auth.getRefreshTokenInProgressValue()).toBe(false);
      expect(auth.getUserValue()).toBeNull();
      expect(auth.getErrorMessageValue()).toBe("expired");
    });
  });

  describe("refreshAccessToken (used by the interceptor)", () => {
    it("exchanges the stored refresh token and emits the new refresh token", () => {
      localStorage.setItem("bg_refreshtoken", "r1");
      let emitted: any;
      auth.refreshAccessToken().subscribe((t) => (emitted = t));
      const req = backend.expectOne(`${API}/user/refresh-auth`);
      expect(req.request.body).toEqual({ token: "r1" });
      req.flush({ user: { _id: "u1" }, token: "a2", refreshToken: "r2" });
      expect(emitted).toBe("r2");
      expect(localStorage.getItem("bg_accesstoken")).toBe("a2");
      expect(localStorage.getItem("bg_refreshtoken")).toBe("r2");
      expect(auth.getUserValue()).toEqual({ _id: "u1" } as any);
    });

    it("errors when the refresh fails", () => {
      let error: any;
      auth.refreshAccessToken().subscribe({ error: (e) => (error = e) });
      backend.expectOne(`${API}/user/refresh-auth`).flush({}, { status: 403, statusText: "x" });
      expect(error).toEqual({ error: "Error" });
    });
  });

  describe("logout", () => {
    it("drops both tokens and the user and returns to the start page", () => {
      localStorage.setItem("bg_accesstoken", "a");
      localStorage.setItem("bg_refreshtoken", "r");
      auth.setUser({ _id: "u1" } as any);
      auth.logout();
      expect(localStorage.getItem("bg_accesstoken")).toBeNull();
      expect(localStorage.getItem("bg_refreshtoken")).toBeNull();
      expect(auth.getUserValue()).toBeUndefined();
      expect(router.navigate).toHaveBeenCalledWith(["/"]);
    });
  });

  describe("roles", () => {
    const as = (roles: string[]) => auth.setUser({ _id: "u1", roles } as any);

    it("reads the permission getters from the first role only", () => {
      as(["admin", "user"]);
      expect(auth.isAdmin).toBe(true);
      expect(auth.isUser).toBe(false);
      as(["contentAdmin"]);
      expect(auth.isContentAdmin).toBe(true);
      as(["scholar"]);
      expect(auth.isScholar).toBe(true);
      as(["user"]);
      expect(auth.isUser).toBe(true);
      expect(auth.isRegisteredUser()).toBe(true);
      expect(auth.getUserId()).toBe("u1");
    });

    it("does not treat other roles as a registered-user role", () => {
      as(["trackAccess"]);
      expect(auth.isRegisteredUser()).toBe(false);
    });
  });

  describe("Authorization header", () => {
    it("is a Bearer token when logged in and absent otherwise", () => {
      expect(auth.createHeaders().has("Authorization")).toBe(false);
      expect(auth.createHeaders().get("Content-Type")).toBe("application/json");
      localStorage.setItem("bg_accesstoken", "tok");
      expect(auth.createHeaders().get("Authorization")).toBe("Bearer tok");
      expect(auth.getAccessToken()).toBe("tok");
    });

    it("is sent on authenticated calls", () => {
      localStorage.setItem("bg_accesstoken", "tok");
      auth.GetUsers();
      const req = backend.expectOne(`${API}/user/user`);
      expect(req.request.headers.get("Authorization")).toBe("Bearer tok");
      req.flush([]);
    });
  });

  describe("account actions", () => {
    it("logs out after the server confirmed the account deletion", async () => {
      auth.setUser({ _id: "u1" } as any);
      const done = auth.DeleteAccountLogout();
      const req = backend.expectOne(`${API}/user/delete-me`);
      expect(req.request.method).toBe("POST");
      expect(req.request.body).toEqual({});
      expect(router.navigate).not.toHaveBeenCalled(); // not before the server answered
      req.flush({ success: true });
      await done;
      expect(router.navigate).toHaveBeenCalledWith(["/"]);
      expect(auth.getUserValue()).toBeUndefined();
    });

    it("keeps the user logged in when the deletion fails", async () => {
      auth.setUser({ _id: "u1" } as any);
      const done = auth.DeleteAccountLogout();
      backend.expectOne(`${API}/user/delete-me`).flush({}, { status: 500, statusText: "x" });
      await expectAsync(done).toBeRejected();
      expect(auth.getUserValue()).toEqual({ _id: "u1" } as any);
      expect(router.navigate).not.toHaveBeenCalled();
    });

    it("pushes the updated profile to all subscribers", async () => {
      const seen: any[] = [];
      auth.getUser().subscribe((u) => seen.push(u));
      const done = auth.updateProfile({ name: "New" });
      const req = backend.expectOne(`${API}/user/profile`);
      expect(req.request.method).toBe("PUT");
      expect(req.request.body).toEqual({ name: "New" });
      req.flush({ success: true, user: { _id: "u1", name: "New" } });
      expect((await done).success).toBe(true);
      expect(seen[seen.length - 1]).toEqual({ _id: "u1", name: "New" });
    });

    it("leaves the user unchanged when the profile update is not successful", async () => {
      auth.setUser({ _id: "u1", name: "Old" } as any);
      const done = auth.updateProfile({ name: "New" });
      backend.expectOne(`${API}/user/profile`).flush({ success: false });
      await done;
      expect(auth.getUserValue()).toEqual({ _id: "u1", name: "Old" } as any);
    });

    it("builds the audit-log query from the given options only", () => {
      auth.getAuditLogs({ limit: 20, severity: "high" });
      const req = backend.expectOne((r) => r.url === `${API}/audit`);
      expect(req.request.params.get("limit")).toBe("20");
      expect(req.request.params.get("severity")).toBe("high");
      expect(req.request.params.has("before")).toBe(false);
      req.flush({});
    });

    it("password reset shows the server toast and goes to login", () => {
      auth.resetPassword("new", "a@b.de", "123456");
      const req = backend.expectOne(`${API}/user/password-reset`);
      expect(req.request.body).toEqual({ newPassword: "new", email: "a@b.de", verificationCode: "123456" });
      req.flush({ message: "Password changed" });
      expect(util.showToast).toHaveBeenCalledWith("Password changed", "dark", 3500);
      expect(router.navigate).toHaveBeenCalledWith(["/user/login"]);
    });

    it("requesting a reset passes the address on to the reset page", () => {
      auth.requestResetPassword({ email: "a@b.de" });
      backend.expectOne(`${API}/user/request-password-reset`).flush({ success: true });
      expect(router.navigate).toHaveBeenCalledWith(["/user/reset-password"], { state: { email: "a@b.de" } });
    });
  });
});
