import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-imprint',
  templateUrl: './imprint.page.html',
  styleUrls: ['./imprint.page.scss'],
})
export class ImprintPage implements OnInit {

  // The German text is the legally binding one; every other app language
  // gets the English translation, with a toggle to switch between the two.
  showGerman = true;

  constructor(public translate: TranslateService) { }

  ngOnInit() {
    this.showGerman = (this.translate.currentLang || this.translate.getDefaultLang()) === 'de';
  }

  toggleLanguage() {
    this.showGerman = !this.showGerman;
  }

}
