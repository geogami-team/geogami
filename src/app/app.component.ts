import { Component } from '@angular/core';

import { Platform } from '@ionic/angular';
import { Plugins, StatusBarStyle } from '@capacitor/core';
import { AuthService } from './services/auth-service.service';
import { LanguageService } from './services/language.service';
import { Network } from '@ionic-native/network/ngx';
import { UtilService } from './services/util.service';
import { environment } from 'src/environments/environment';
import { ConsoleToggleServiceService } from './services/console-toggle.service';
import { GameSessionService } from './services/game-session.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
})
export class AppComponent {
  networkAlert;

  constructor(
    private platform: Platform,
    private authService: AuthService,
    private languageService: LanguageService,
    private network: Network,
    private utilService: UtilService,
    private consoleToggleService: ConsoleToggleServiceService,
    private gameSessionService: GameSessionService) {

    void this.gameSessionService.discardLegacyProgress();
    this.initializeApp();

    if (window.localStorage.getItem('bg_refreshtoken'))
      this.authService.recoverSession(
        window.localStorage.getItem('bg_refreshtoken')
      );
  }

  initializeApp() {
    this.platform.ready().then(() => {
      Plugins.StatusBar.setStyle({ style: StatusBarStyle.Light }).catch((err) =>
      console.log(err)
      );

      // hide console logs
      this.consoleToggleService.disableConsoleInProduction();

      if (this.platform.is('android')) {
        Plugins.StatusBar.setBackgroundColor({ color: 'white' });
      }

      // Translate impl.
      this.languageService.setInitialAppLangauge();

      // Check internet connection
      this.checkInternetConnection();
    });

  }

  checkInternetConnection() {
    // watch network for a disconnection
    let disconnectSubscription = this.network.onDisconnect().subscribe(async () => {
      //// console.log('network was disconnected :-(');
      this.utilService.setIsOnlineValue(false);   // set behaviour sub. false
      this.networkAlert = await this.utilService.showToastBtn("No connection", 'dark', null)   // show toast
      this.networkAlert.present();
    });

    let connectSubscription = this.network.onConnect().subscribe(() => {
      //// console.log('network connected!');
      this.utilService.setIsOnlineValue(true);   // set behaviour sub. true
      this.utilService.showToast("Back online", 'success', 3000)   // show toast
      // Remove notification when connection get back
      if (this.networkAlert) {
        this.networkAlert.dismiss();
      }
    });
  }
}
