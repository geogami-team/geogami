import { Component } from "@angular/core";
import { NavController } from "@ionic/angular";
import { APP_MANAGEMENT_TILES, AppManagementTile, auditUnreadFrom } from "src/app/models/app-management";
import { AuthService } from "src/app/services/auth-service.service";

/**
 * "App management": the one place administrators reach their tools from — the user
 * list, the Simple/Advanced visibility editor, the app update prompt and the audit log. Each tile opens the
 * tool's own page, which keeps its own route and guard.
 */
@Component({
  selector: "app-app-management",
  templateUrl: "./app-management.page.html",
  styleUrls: ["./app-management.page.scss"],
})
export class AppManagementPage {
  // Unread audit entries, shown on the audit-log tile (best effort).
  auditUnread = 0;
  auditAlerts = 0;

  constructor(private authService: AuthService, private navCtrl: NavController) {}

  /** The tools this user may open (checked against every role of the user). */
  get tiles(): ReadonlyArray<AppManagementTile> {
    return APP_MANAGEMENT_TILES.filter((tile) => this.authService.hasAnyRole(tile.roles));
  }

  // Runs on first open and every time the user returns from a tool, so the badge stays current.
  ionViewWillEnter() {
    this.loadAuditUnread();
  }

  loadAuditUnread() {
    if (!this.tiles.some((tile) => tile.id === "audit-log")) {
      return;
    }
    this.authService
      .getAuditUnreadCount()
      .then((res: any) => {
        const unread = auditUnreadFrom(res);
        this.auditUnread = unread.count;
        this.auditAlerts = unread.alerts;
      })
      .catch(() => {
        /* the badge is best-effort */
      });
  }

  open(tile: AppManagementTile) {
    this.navCtrl.navigateForward(tile.route);
  }

  trackById(_index: number, tile: AppManagementTile) {
    return tile.id;
  }
}
