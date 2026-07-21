import { Injectable } from '@angular/core';
import { CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { AuthService } from './auth-service.service';

const VERIFY_EMAIL_PATH = 'user/verify-email';

@Injectable({
  providedIn: 'root',
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  //* a guard to decide if a route can be activated https://angular.io/api/router/CanActivate
  canActivate(_route, state: RouterStateSnapshot) {
    const user: any = this.authService.getUserValue();
    if (user) {
      // Login issues a token even before the email is confirmed (so the
      // account can reach the verify-email page), so being authenticated
      // is not enough here — an unconfirmed account may only stay on that
      // one page. Without this, a back-button press or a page refresh
      // (which re-runs this guard) would otherwise let an unconfirmed user
      // straight back into the app.
      if (!user.emailIsConfirmed && !state.url.startsWith('/' + VERIFY_EMAIL_PATH)) {
        // replaceUrl so a blocked back-button press overwrites the entry it
        // landed on instead of pushing a new one — otherwise every back
        // press adds another verify-email entry on top, and the stack only
        // ever grows: back-button becomes unable to get past this page.
        this.router.navigate([VERIFY_EMAIL_PATH], { replaceUrl: true });
        return false;
      }
      return true;
    } else {
      // super dirty hack for now
      if (this.authService.getRefreshTokenInProgressValue()) return true;
      this.router.navigate(['user/login'], { replaceUrl: true });
      return false;
    }
  }
}

// For routes that must stay reachable by anonymous visitors (e.g. the
// "start" home page also serves as a public landing page) but that render
// personalized/authenticated content once a user is logged in — an
// unconfirmed account landing here (e.g. via the browser's back button)
// would otherwise see their username, Profile card, etc. Unlike AuthGuard,
// this never blocks an anonymous visitor; it only intercepts the
// logged-in-but-unconfirmed case.
@Injectable({
  providedIn: 'root',
})
export class ConfirmedOrGuestGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(_route, state: RouterStateSnapshot) {
    const user: any = this.authService.getUserValue();
    if (user && !user.emailIsConfirmed && !state.url.startsWith('/' + VERIFY_EMAIL_PATH)) {
      // replaceUrl — see AuthGuard for why (avoids a back-button stack that
      // only ever grows).
      this.router.navigate([VERIFY_EMAIL_PATH], { replaceUrl: true });
      return false;
    }
    return true;
  }
}
