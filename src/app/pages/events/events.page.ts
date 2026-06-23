import { Component, OnInit } from "@angular/core";
import { ModalController, NavController } from "@ionic/angular";
import { TranslateService } from "@ngx-translate/core";

import { AuthService } from "../../services/auth-service.service";
import { EventsService } from "../../services/events.service";
import { UtilService } from "../../services/util.service";
import { GeoEvent } from "../../models/event";
import { EventFormModalComponent } from "./event-form-modal/event-form-modal.component";
import { DeleteEventModalComponent } from "./delete-event-modal/delete-event-modal.component";

/**
 * "My Events" page: lists the scholar's events (experimental studies & school
 * excursions), with create / edit / delete and a per-event PDF export.
 * Restricted to admin / contentAdmin / scholar, like the evaluate page.
 */
@Component({
  selector: "app-events",
  templateUrl: "./events.page.html",
  styleUrls: ["./events.page.scss"],
})
export class EventsPage implements OnInit {
  events: GeoEvent[] = [];
  loading = true;

  user = this.authService.getUser();

  constructor(
    public navCtrl: NavController,
    private authService: AuthService,
    private eventsService: EventsService,
    private modalController: ModalController,
    private utilService: UtilService,
    private translate: TranslateService
  ) {}

  ngOnInit() {}

  ionViewWillEnter() {
    // Role gate — same set as the evaluate page.
    this.user.subscribe((u) => {
      if (
        u == null ||
        !["admin", "contentAdmin", "scholar"].includes(u["roles"][0])
      ) {
        this.navCtrl.navigateForward("/");
      }
    });
    this.loadEvents();
  }

  async loadEvents() {
    this.loading = true;
    try {
      const res = await this.eventsService.getUserEvents();
      this.events = res?.content || [];
    } catch (err) {
      console.log(err);
      this.utilService.showToast(
        this.translate.instant("Events.loadError"),
        "danger"
      );
    } finally {
      this.loading = false;
    }
  }

  async openCreate() {
    const modal = await this.modalController.create({
      component: EventFormModalComponent,
      backdropDismiss: false,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.saved) this.loadEvents();
  }

  async openEdit(event: GeoEvent) {
    const modal = await this.modalController.create({
      component: EventFormModalComponent,
      backdropDismiss: false,
      componentProps: { event },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.saved) this.loadEvents();
  }

  async confirmDelete(event: GeoEvent) {
    const modal = await this.modalController.create({
      component: DeleteEventModalComponent,
      componentProps: { eventName: event.name },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.confirmed) {
      try {
        await this.eventsService.deleteEvent(event._id);
        this.utilService.showToast(
          this.translate.instant("Events.deleted"),
          "success"
        );
        this.loadEvents();
      } catch (err) {
        console.log(err);
        this.utilService.showToast(
          this.translate.instant("Events.deleteError"),
          "danger"
        );
      }
    }
  }

  // Wired in Phase 3 (multi-game QR PDF export).
  downloadPdf(event: GeoEvent) {
    this.utilService.showToast(
      this.translate.instant("Events.pdfComingSoon"),
      "medium"
    );
  }

  gameCount(event: GeoEvent): number {
    return (event.games || []).length;
  }
}
