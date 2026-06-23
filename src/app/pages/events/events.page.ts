import { Component, OnInit } from "@angular/core";
import { ModalController, NavController } from "@ionic/angular";
import { TranslateService } from "@ngx-translate/core";
import QRCode from "qrcode";

import { AuthService } from "../../services/auth-service.service";
import { EventsService } from "../../services/events.service";
import { UtilService } from "../../services/util.service";
import { GeoEvent } from "../../models/event";
import { environment } from "../../../environments/environment";
import { downloadEventQrPdf, EventQrGame } from "../../helpers/event-qr-pdf";
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
  // Id of the event whose PDF is currently being generated (disables its button).
  generatingPdfFor: string | null = null;

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

  /**
   * Build and download the event's QR PDF: one QR per game, each linking to a
   * play attributed to the event OWNER (uId) and tagged with the event
   * (eventId), so collected tracks reach the owner regardless of who exported
   * the PDF.
   */
  async downloadPdf(event: GeoEvent) {
    const games = event.games || [];
    if (games.length === 0) {
      this.utilService.showToast(
        this.translate.instant("Events.pdfNoGames"),
        "warning"
      );
      return;
    }

    // Owner is populated on the event ({ _id, name, username }).
    const ownerId = event.user?._id || event.user;
    const ownerName =
      event.user?.name || event.user?.username || "";

    this.generatingPdfFor = event._id;
    try {
      const qrGames: EventQrGame[] = [];
      for (const game of games) {
        const link =
          `${environment.uiURL}/play-game/game-detail` +
          `?gameId=${game._id}` +
          `&uId=${ownerId}` +
          `&iName=${encodeURIComponent(ownerName)}` +
          `&eventId=${event._id}`;
        // High resolution so the printed QR stays crisp.
        const qrDataUrl = await QRCode.toDataURL(link, {
          width: 600,
          margin: 1,
        });
        qrGames.push({ gameName: game.name, qrDataUrl, link });
      }

      await downloadEventQrPdf({
        eventName: event.name,
        eventDescription: event.description,
        instructorLabel: this.translate.instant("PlayGame.instructorLabel"),
        instructorName: ownerName,
        scanCaption: this.translate.instant("PlayGame.scanToPlay"),
        gamesHeading: this.translate.instant("Events.gamesHeading"),
        games: qrGames,
        logoUrl: "/assets/icons/icon-512x512.png",
      });
    } catch (err) {
      console.log(err);
      this.utilService.showToast(
        this.translate.instant("Events.pdfError"),
        "danger"
      );
    } finally {
      this.generatingPdfFor = null;
    }
  }

  gameCount(event: GeoEvent): number {
    return (event.games || []).length;
  }
}
