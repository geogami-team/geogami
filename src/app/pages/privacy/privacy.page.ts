import { Component, OnInit } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-privacy',
  templateUrl: './privacy.page.html',
  styleUrls: ['./privacy.page.scss'],
})
export class PrivacyPage implements OnInit {

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

  // Plain `href="#id"` links would be picked up by the Angular router, so the
  // table of contents scrolls to the section itself.
  scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

}
