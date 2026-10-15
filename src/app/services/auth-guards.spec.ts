import { AuthGuard, ConfirmedOrGuestGuard } from "./auth-gard.service";

// Characterization tests for AuthGuard and ConfirmedOrGuestGuard (RoleGuard is
// covered in auth-gard.service.spec.ts).
describe("AuthGuard", () => {
  let user: any;
  let refreshing: boolean;
  let router: jasmine.SpyObj<any>;
  let guard: AuthGuard;
  const at = (url: string): any => ({ url });

  beforeEach(() => {
    user = null;
    refreshing = false;
    router = jasmine.createSpyObj("Router", ["navigate"]);
    guard = new AuthGuard(
      { getUserValue: () => user, getRefreshTokenInProgressValue: () => refreshing } as any,
      router
    );
  });

  it("lets a confirmed user through", () => {
    user = { emailIsConfirmed: true };
    expect(guard.canActivate(null, at("/play"))).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("keeps an unconfirmed user on the verify-email page only", () => {
    user = { emailIsConfirmed: false };
    expect(guard.canActivate(null, at("/user/verify-email"))).toBe(true);
    expect(guard.canActivate(null, at("/user/verify-email?x=1"))).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("sends an unconfirmed user from any other page to verify-email, replacing the history entry", () => {
    user = { emailIsConfirmed: false };
    expect(guard.canActivate(null, at("/play"))).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(["user/verify-email"], { replaceUrl: true });
  });

  it("sends a signed-out visitor to the login page, replacing the history entry", () => {
    expect(guard.canActivate(null, at("/play"))).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(["user/login"], { replaceUrl: true });
  });

  it("lets a signed-out visitor through while the session is still being restored", () => {
    refreshing = true;
    expect(guard.canActivate(null, at("/play"))).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});

describe("ConfirmedOrGuestGuard", () => {
  let user: any;
  let router: jasmine.SpyObj<any>;
  let guard: ConfirmedOrGuestGuard;
  const at = (url: string): any => ({ url });

  beforeEach(() => {
    user = null;
    router = jasmine.createSpyObj("Router", ["navigate"]);
    guard = new ConfirmedOrGuestGuard({ getUserValue: () => user } as any, router);
  });

  it("never blocks an anonymous visitor", () => {
    expect(guard.canActivate(null, at("/"))).toBe(true);
  });

  it("lets a confirmed user through", () => {
    user = { emailIsConfirmed: true };
    expect(guard.canActivate(null, at("/"))).toBe(true);
  });

  it("redirects an unconfirmed user to verify-email, but not when already there", () => {
    user = { emailIsConfirmed: false };
    expect(guard.canActivate(null, at("/"))).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(["user/verify-email"], { replaceUrl: true });
    router.navigate.calls.reset();
    expect(guard.canActivate(null, at("/user/verify-email"))).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });
});
