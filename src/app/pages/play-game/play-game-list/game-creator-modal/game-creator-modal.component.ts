import { Component, Input, OnInit } from "@angular/core";
import { ModalController } from "@ionic/angular";
import { TranslateService } from "@ngx-translate/core";

import { GamesService } from "src/app/services/games.service";
import { AuthService } from "src/app/services/auth-service.service";
import { UtilService } from "src/app/services/util.service";
import { UserDetailsModalComponent } from "src/app/pages/user/user-management/user-details-modal/user-details-modal.component";

/**
 * Admin-only modal showing who created a game (username, name, email) and
 * when. The data is fetched only when the modal is opened — the game list
 * endpoints carry no creator details. "More details about user" lazily loads
 * the full account and opens the same UserDetailsModalComponent used on the
 * user-management page (Profile + Games created tabs).
 */
@Component({
  selector: "app-game-creator-modal",
  templateUrl: "./game-creator-modal.component.html",
})
export class GameCreatorModalComponent implements OnInit {
  @Input() game: any;

  creator: any = null;
  createdAt: string = null;
  loading = true;
  failed = false;
  busy = false;

  constructor(
    public modalController: ModalController,
    private gamesService: GamesService,
    private authService: AuthService,
    private utilService: UtilService,
    private translate: TranslateService
  ) {}

  async ngOnInit() {
    try {
      const res = await this.gamesService.getGameCreatorInfo(this.game._id);
      // creator === null means the account was deleted; the template then
      // shows a fallback note and hides the "More details" button, while
      // createdAt is still displayed.
      this.creator = res?.creator || null;
      this.createdAt = res?.createdAt || null;
    } catch (e) {
      this.failed = true;
      this.utilService.showToast(
        this.translate.instant("PlayGame.creatorError"),
        "danger"
      );
    } finally {
      this.loading = false;
    }
  }

  // Second lazy step: fetch the full account only when asked for, then stack
  // the shared User-details modal on top of this one.
  async openUserDetails() {
    // busy guards against double-taps while the request is in flight.
    if (!this.creator?._id || this.busy) {
      return;
    }
    this.busy = true;
    try {
      // Re-fetch the account instead of passing this.creator along: the
      // creator payload is deliberately slim (_id, username, name, email),
      // but UserDetailsModalComponent renders the full profile (roles,
      // language, createdAt, emailIsConfirmed, unconfirmedEmail) and its
      // Games tab needs a complete user object. GET /user/user/:id (admin)
      // returns the user document directly — unwrapped — which is exactly
      // the shape the modal receives from the user-management page, so both
      // entry points stay in sync.
      const user = await this.authService.getUserById(this.creator._id);
      const modal = await this.modalController.create({
        component: UserDetailsModalComponent,
        componentProps: { user },
      });
      // Presented on top of this modal (Ionic stacks modals); closing it
      // returns the admin here rather than to the game list.
      await modal.present();
    } catch (e) {
      this.utilService.showToast(
        this.translate.instant("PlayGame.creatorError"),
        "danger"
      );
    } finally {
      this.busy = false;
    }
  }

  close() {
    this.modalController.dismiss();
  }
}
