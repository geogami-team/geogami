import { Component, Input, OnInit } from "@angular/core";
import { ModalController } from "@ionic/angular";
import { TranslateService } from "@ngx-translate/core";

import { GamesService } from "../../../../services/games.service";
import { UtilService } from "../../../../services/util.service";

/**
 * Modal to manage a game's co-authors (editors). The owner (or an admin) can
 * add another registered user by email or remove an existing co-author.
 * Co-authors may edit and publish the game and get track access; they cannot
 * delete it or manage this list. Dismisses with { changed } so the list page
 * can refresh the game's editors.
 */
@Component({
  selector: "app-share-game-modal",
  templateUrl: "./share-game-modal.component.html",
})
export class ShareGameModalComponent implements OnInit {
  @Input() game: any;

  editors: string[] = [];
  emailInput = "";
  loading = true;
  busy = false;
  changed = false;

  constructor(
    public modalController: ModalController,
    private gamesService: GamesService,
    private utilService: UtilService,
    private translate: TranslateService
  ) {}

  async ngOnInit() {
    await this.loadEditors();
  }

  private async loadEditors() {
    this.loading = true;
    try {
      const res = await this.gamesService.getGameEditors(this.game._id);
      this.editors = res?.editors || [];
    } catch (e) {
      this.editors = [];
    } finally {
      this.loading = false;
    }
  }

  async addEditor() {
    const email = (this.emailInput || "").trim().toLowerCase();
    if (!email || !email.includes("@")) {
      this.utilService.showToast(
        this.translate.instant("PlayGame.shareInvalidEmail"),
        "danger"
      );
      return;
    }
    this.busy = true;
    try {
      const res = await this.gamesService.addGameEditors(this.game._id, [email]);
      this.editors = res?.body?.editors || this.editors;
      this.emailInput = "";
      this.changed = true;
      if (res?.body?.message) {
        this.utilService.showToast(
          res.body.message,
          res.status === 200 ? "success" : "warning"
        );
      }
    } catch (e) {
      // When every email is rejected (e.g. no account) the server replies 400
      // with a helpful message in the body — show that instead of a generic error.
      const serverMsg = (e as any)?.error?.message;
      this.utilService.showToast(
        serverMsg || this.translate.instant("PlayGame.shareError"),
        serverMsg ? "warning" : "danger"
      );
    } finally {
      this.busy = false;
    }
  }

  async removeEditor(email: string) {
    this.busy = true;
    try {
      const res = await this.gamesService.removeGameEditors(this.game._id, [
        email,
      ]);
      this.editors = res?.body?.editors || this.editors.filter((e) => e !== email);
      this.changed = true;
    } catch (e) {
      const serverMsg = (e as any)?.error?.message;
      this.utilService.showToast(
        serverMsg || this.translate.instant("PlayGame.shareError"),
        serverMsg ? "warning" : "danger"
      );
    } finally {
      this.busy = false;
    }
  }

  close() {
    // Return the final editors list so the parent can update its in-memory copy
    // without a full re-fetch (which would reset the env/segment view).
    this.modalController.dismiss({ changed: this.changed, editors: this.editors });
  }
}
