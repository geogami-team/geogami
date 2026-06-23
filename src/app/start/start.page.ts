import { Component, OnInit } from "@angular/core";
import { AlertController, ToastController } from "@ionic/angular";
import { NavController } from "@ionic/angular";

import { TranslateService } from "@ngx-translate/core";

import { Capacitor, Plugins } from "@capacitor/core";
import { AuthService } from "../services/auth-service.service";
import { LanguageService } from "../services/language.service";
import { GamesService } from "../services/games.service";
import { UtilService } from "../services/util.service";

@Component({
  selector: "app-start",
  templateUrl: "./start.page.html",
  styleUrls: ["./start.page.scss"],
})
export class StartPage implements OnInit {
  playerMode: String;
  playerModeDescription: String;
  developerMode: String;
  developerModeDescription: String;
  evaluateMode: String;
  evaluateModeDescription: String;

  device: any;

  user = this.authService.getUser();

  // Vr world
  // to only allow admins to see pages related to VR games
  userRole: string;

  // (translation)
  languages = [];
  selected = "";

  // latest app version
  latestAppVersionInfo: any;
  isWebPlatform = (Capacitor.platform == 'web');

  // web app version (latest GitHub release) — native platforms read it from the device instead
  webAppVersion: string = "";

  constructor(
    public navCtrl: NavController,
    public toastController: ToastController,
    public _translate: TranslateService,
    private authService: AuthService,
    private languageService: LanguageService,
    private alertController: AlertController,
    private gamesService: GamesService,
    public utilService: UtilService
  ) {}

  async ngOnInit() {
    /* if device is not connected to internet, show notification */
    /* if (!this.utilService.getIsOnlineValue()) {
      return;
    } */

    // get current app version
    Plugins.Device.getInfo().then((device) => (this.device = device));

    // get updated app version to notify user of app update
    if (Capacitor.platform != "web") {
      this.checkNewAppVersion();
    } else {
      // on web, just show the latest GitHub release version
      this.gamesService
        .getGithubLatestVersion()
        .then((res) => (this.webAppVersion = res?.content?.version))
        .catch(() => {});
    }

    // (translation) get languages
    this.languages = this.languageService.getLangauges();
    // (translation) set selected language (no need for it)
    this.selected = this.languageService.selected;

    // Get user role
    this.user.subscribe((event) => {
      if (event != null) {
        this.userRole = event["roles"][0];
      }
    });
  }

  checkNewAppVersion() {
    this.gamesService
      .getAppVersion()
      .then((res) => res.content)
      .then((latestVersionInfo) => {
        this.latestAppVersionInfo = latestVersionInfo;
        if (this.latestAppVersionInfo.enabled) {
          if (Capacitor.platform == "ios" && this.latestAppVersionInfo.ios) {
            this.showUpdateAppAlert(
              this.versionToInt(this.latestAppVersionInfo.version),
              parseInt(this.latestAppVersionInfo.build),
              this.latestAppVersionInfo.major
            );
          } else if (
            Capacitor.platform == "android" &&
            this.latestAppVersionInfo.android
          ) {
            this.showUpdateAppAlert(
              this.versionToInt(this.latestAppVersionInfo.version),
              parseInt(this.latestAppVersionInfo.build),
              this.latestAppVersionInfo.major
            );
          }
        }
      });
  }

  handleCardClick(e) {
// console.log(e);
  }

  navigateGamesPlayPage() {
    this.navCtrl.navigateForward(`play-game/play-game-list`);
  }

  navigateBarcodeScannerPage() {
    this.navCtrl.navigateForward(`barcode-scanner`);
  }

  navigateShowroomPage() {
    this.navCtrl.navigateForward("showroom");
  }

  navigateInfoPage() {
    this.navCtrl.navigateForward("info");
  }

  navigateAnalyzePage() {
    // this.navCtrl.navigateForward("analyze");
    this.navCtrl.navigateForward("analyze/dashboard");
  }

  navigateUserManagement() {
    this.navCtrl.navigateForward("user/user-management");
  }

  login() {
    this.navCtrl.navigateForward("user/login");
  }

  navigateProfile() {
    this.navCtrl.navigateForward("user/profile");
  }

  navigateEventsPage() {
    this.navCtrl.navigateForward("events");
  }

  changeLng(lng: string) {
    this.languageService.setLanguage(lng);
  }

  async showUpdateAppAlert(latestDeployedVersion, latestBuild, isMajorUpdate) {
    let currentAppVersion = this.versionToInt(this.device?.appVersion);
    //let currentAppBuild = parseInt(this.device.appBuild);

    // alert buttons objects
    let btnOption1 = {
      text: this._translate.instant("Start.notNow"),
      handler: () => {
        // Do nothing
      },
    };
    let btnOption2 = {
      text: this._translate.instant("Start.update"),
      cssClass: "alert-button-update",
      handler: () => {
        if (Capacitor.platform == "ios") {
          window.open(
            "https://apps.apple.com/app/geogami/id1614864078",
            "_system"
          );
        } else if (Capacitor.platform == "android") {
          window.open(
            "https://play.google.com/store/apps/details?id=com.ifgi.geogami",
            "_system"
          );
        }
      },
    };

    if (
      currentAppVersion <
      latestDeployedVersion /* || ( currentAppVersion == latestVersion && currentAppBuild < latestBuild) */
    ) {
      const alert = await this.alertController.create({
        backdropDismiss: false, // disable alert dismiss when backdrop is clicked
        header: this._translate.instant(
          isMajorUpdate ? "Start.majorAppUpdateHeader" : "Start.appUpdateHeader"
        ),
        //subHeader: 'Important message',
        message: this._translate.instant(
          isMajorUpdate ? "Start.majorAppUpdateMsg" : "Start.appUpdateMsg"
        ),
        buttons: isMajorUpdate ? [btnOption2] : [btnOption1, btnOption2],
      });
      await alert.present();
    }
  }

  /************/
  /* convert a "major.minor.patch" version string to a comparable integer.
     Each part gets its own 3-digit slot so multi-digit parts compare
     correctly, e.g. 6.10.0 (6010000) > 6.9.0 (6009000). */
  versionToInt(VersionInString) {
    if (!VersionInString) {
      return 0;
    }
    const parts = String(VersionInString)
      .split(".")
      .map((p) => parseInt(p, 10) || 0);
    const [major = 0, minor = 0, patch = 0] = parts;
    return major * 1000000 + minor * 1000 + patch;
  }
}
