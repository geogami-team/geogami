import { Component, OnInit } from '@angular/core';
const { BarcodeScanner, SupportedFormat } = Plugins;
import { Plugins } from "@capacitor/core";
import { ModalController, NavController } from '@ionic/angular';
import { SocketService } from 'src/app/services/socket.service';
import { UtilService } from 'src/app/services/util.service';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-barcode-scanner',
  templateUrl: './barcode-scanner.page.html',
  styleUrls: ['./barcode-scanner.page.scss'],
})
export class BarcodeScannerPage implements OnInit {

  constructor(
    private utilService: UtilService,
    public modalController: ModalController,
    private navCtrl: NavController,
    private translate: TranslateService,
    // private socketService: SocketService
  ) { }

  ngOnInit() {
  }

  ionViewWillEnter() {
    /* //* in case user has joined room and pressed back button
    if(this.socketService.socket){
      this.socketService.socket.disconnect();
    }

    /* prepare then start scanning */
    BarcodeScanner.prepare();
    this.startScan();
  }

  ngOnDestroy() {
    // To stop scanning when leaving the page
    this.stopScan();
  }

  /**********/
  // tutorial: https://www.youtube.com/watch?v=8GXfjDUCYjU
  async startScan() {
    const allowed = await this.checkPermission()
    if (allowed) {
      // console.log("🚀 allowed")

      /* make background of WebView transparent, another step is adding some style to global.scss */
      BarcodeScanner.hideBackground();
      document.querySelector('body').classList.add('scanner-active');

      /* specified qr-code */
      const result = await BarcodeScanner.startScan({ targetedFormats: ['QR_CODE'] }); // start scanning and wait for a result

      /* if the result has content */
      if (result.hasContent) {
        const content: string = result.content;
        console.log(content); // log the raw scanned content

        // Two recognised QR formats:
        //  - Class QR (single-player): a full URL with query params, e.g.
        //    .../play-game/game-detail?gameId=X&uId=Y
        //  - Old multiplayer teacher code: a bare string uId(24) + "-" + gameId
        let gameId = "";
        let uId = "";
        let iName = "";
        if (content.includes("game-detail") || content.startsWith("http")) {
          try {
            const params = new URL(content).searchParams;
            gameId = params.get("gameId") || "";
            uId = params.get("uId") || params.get("instructor") || "";
            iName = params.get("iName") || "";
          } catch (e) {
            console.log("Unrecognised QR URL:", content);
          }
        } else {
          // Old multiplayer teacher-code format — kept for backward compat.
          uId = content.slice(0, 24);
          gameId = content.slice(25);
          this.utilService.setQRCodeValue(content);
        }

        if (gameId) {
          let target = `play-game/game-detail?gameId=${gameId}&uId=${uId}`;
          if (iName) {
            target += `&iName=${encodeURIComponent(iName)}`;
          }
          this.navCtrl.navigateForward(target);
        } else {
          this.utilService.showToast(
            this.translate.instant("PlayGame.unrecognisedQr"),
            "dark",
            3000
          );
        }
      }
    }
  }

  /********/
  async stopScan() {
    BarcodeScanner.showBackground();
    document.querySelector('body').classList.remove('scanner-active');
    /* stop scan */
    BarcodeScanner.stopScan();
  };

  async checkPermission() {
    return new Promise(async (resolve, rejects) => {
      const status = await BarcodeScanner.checkPermission({ force: true });
      if (status.granted) {
        resolve(true);
      } else if (status.denied) {
        // ToDo: update
        BarcodeScanner.openAppSettings();
      } else {
        resolve(false);
      }
    });
  }
}
