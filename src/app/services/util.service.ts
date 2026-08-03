import { Injectable } from "@angular/core";
import {
  AlertController,
  PopoverController,
  ToastController,
} from "@ionic/angular";
import { TranslateService } from "@ngx-translate/core";
import { BehaviorSubject } from "rxjs";
import { PopoverComponent } from "src/app/popover/popover.component";
import mapboxgl from "mapbox-gl";
import { virEnvLayers } from "src/app/models/virEnvsLayers";


@Injectable({
  providedIn: "root",
})
export class UtilService {
  private isOnline$: BehaviorSubject<boolean>;
  private qrCode$: BehaviorSubject<string>;

  constructor(
    private toastCtr: ToastController,
    private alertCtr: AlertController,
    public popoverController: PopoverController,
    private translate: TranslateService
  ) {
    this.isOnline$ = new BehaviorSubject(true);
    this.qrCode$ = new BehaviorSubject("");
  }

  async showToast(msg, colorV = "dark", durationV = 3000, cssStyle = "") {
    const toast = await this.toastCtr.create({
      message: msg,
      color: colorV,
      animated: true,
      duration: durationV,
      cssClass: cssStyle,
    });
    toast.present();
  }

  async showToastBtn(msg, colorV = "dark", durationV = 3000) {
    const toast = await this.toastCtr.create({
      message: msg,
      color: colorV,
      animated: true,
      duration: durationV,
      cssClass: "custom-toast",
      buttons: [
        {
          text: "Dismiss",
          role: "cancel",
          handler: () => {
            // Do nothing
          },
        },
      ],
    });
    return toast;
  }

  // Author-facing validation errors (empty game name, "name already exists",
  // missing task instruction / destination / direction, …) used to appear either as
  // a toast at the bottom of the screen or as a small card at the top of a long,
  // scrollable page — both easy to miss (reported feedback: "users couldn't notice
  // the error"). Show them centered on screen in danger colour, with an alert icon
  // and a manual close button, so they clearly stand out. Single source of truth so
  // every validation error across the app looks and behaves the same.
  async showValidationError(msg: string) {
    const toast = await this.toastCtr.create({
      message: msg,
      color: "danger",
      icon: "alert-circle-outline",
      position: "middle",
      animated: true,
      duration: 4000,
      cssClass: "validation-toast",
      buttons: [
        {
          icon: "close",
          role: "cancel",
        },
      ],
    });
    toast.present();
  }

  async showAlertNoConnection() {
    const alert = await this.alertCtr.create({
      backdropDismiss: false, // disable alert dismiss when backdrop is clicked
      header: "No Internet Connection",
      //subHeader: 'Important message',
      message: "Please check your connection and try again.",
      buttons: [
        /* 'OK' */
        {
          text: "OK",
          //cssClass: 'alert-button-update',
          role: "cancel",
          handler: () => {},
        },
      ],
    });
    await alert.present();
  }

  /* set and get network connection status */
  getIsOnlineValue() {
    return this.isOnline$.getValue();
  }

  setIsOnlineValue(val) {
    return this.isOnline$.next(val);
  }

  /* get qr code observer */
  getQRCode() {
    return this.qrCode$.asObservable();
  }

  getQRCodeValue() {
    return this.qrCode$.getValue();
  }

  setQRCodeValue(val) {
    return this.qrCode$.next(val);
  }

  /* showPopover without translation */
  async showPopover(ev: any, text: string) {
    const popover = await this.popoverController.create({
      component: PopoverComponent,
      event: ev,
      translucent: true,
      componentProps: { text },
    });
    return await popover.present();
  }

  /* showPopover with translation */
  async showPopover_i18n(ev: any, key: string) {
    let text = this.translate.instant(key);

    const popover = await this.popoverController.create({
      component: PopoverComponent,
      event: ev,
      translucent: true,
      componentProps: { text },
    });
    return await popover.present();
  }

  async showAlert(header: string, msg: string) {
    const alert = await this.alertCtr.create({
      backdropDismiss: false, // disable alert dismiss when backdrop is clicked
      header: header,
      //subHeader: 'Important message',
      message: msg,
      buttons: [
        /* 'OK' */
        {
          text: "OK",
          //cssClass: 'alert-button-update',
          role: "cancel",
          handler: () => {},
        },
      ],
    });
    await alert.present();
  }

  showAlertTwoButtons(
    header: string,
    msg: string,
    btnText1: string,
    btnText2: string,
    alertDismiss = false
  ): Promise<Boolean> {
    return new Promise((resolve) => {
      this.alertCtr
        .create({
          backdropDismiss: alertDismiss, // disable alert dismiss when backdrop is clicked
          header: header,
          message: msg,
          buttons: [
            {
              text: btnText1,
              handler: () => {
                // close alert
                resolve(false);
              },
            },
            {
              text: btnText2,
              cssClass: "alert-button-confirm",
              handler: () => {
                resolve(true);
              },
            },
          ],
        })
        .then((alert) => {
          // Present the alert
          alert.present();
        });
    });
  }
}
