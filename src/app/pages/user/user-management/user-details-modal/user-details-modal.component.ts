import { Component, Input, OnInit } from "@angular/core";
import { ModalController } from "@ionic/angular";
import { AuthService } from "src/app/services/auth-service.service";

@Component({
  selector: "app-user-details-modal",
  templateUrl: "./user-details-modal.component.html",
  styleUrls: ["./user-details-modal.component.scss"],
})
export class UserDetailsModalComponent implements OnInit {
  // Pushed in via componentProps when opening the modal.
  @Input() user: any;

  // Simple tab switch — cheap enough that introducing a router/tabs module is overkill.
  selectedTab: "profile" | "games" = "profile";

  games: any[] = [];
  gamesLoading = false;
  gamesLoaded = false;
  gamesError = "";

  constructor(
    public modalController: ModalController,
    private authService: AuthService
  ) {}

  ngOnInit() {}

  onTabChange(tab: "profile" | "games") {
    this.selectedTab = tab;
    // Lazy-load games only on first visit to the tab.
    if (tab === "games" && !this.gamesLoaded && !this.gamesLoading) {
      this.loadGames();
    }
  }

  private loadGames() {
    if (!this.user || !this.user._id) return;
    this.gamesLoading = true;
    this.gamesError = "";
    this.authService
      .getGamesByUserId(this.user._id)
      .then((res) => {
        this.games = (res && res.games) ? res.games : [];
        this.gamesLoaded = true;
      })
      .catch(() => {
        this.gamesError = "Could not load games for this user.";
      })
      .finally(() => {
        this.gamesLoading = false;
      });
  }

  dismiss() {
    this.modalController.dismiss();
  }
}
