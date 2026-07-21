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
        this.router.navigate([VERIFY_EMAIL_PATH]);
        return false;
      }
      return true;
    } else {
      // super dirty hack for now
      if (this.authService.getRefreshTokenInProgressValue()) return true;
      this.router.navigate(['user/login']);
      return false;
    }
  }
}
