import { TranslateService } from '@ngx-translate/core';
import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';

const LNG_KEY = 'SELECTED_LANGUAGE';
const lngs = ['de', 'en'];

@Injectable({
  providedIn: 'root'
})
export class LanguageService {
  selected = '';

  constructor(private translate: TranslateService, private storage: Storage) { }

  setInitialAppLangauge() {
    // 1. check if lang have been stored
    // 2. check if device default lang can be fetched and it's one of the supported language
    // 3. use german as a default lang
    this.storage.get(LNG_KEY).then(val => {
      if (val) {
        this.setLanguage(val);
        this.selected = val
      } else {
        let langauge = this.translate.getBrowserCultureLang(); // Get browser lang
        if (lngs.includes((langauge.toLowerCase().slice(0, 2)))) {
          this.translate.setDefaultLang(langauge.toLowerCase().slice(0, 2));
          this.selected = langauge.toLowerCase().slice(0, 2);
        } else {
          this.setLanguage('de') // german is the default lang if browser lang is not supported
        }
      }
      //this.storage.clear()
    });
  }

  getLangauges() {
    return [
      { value: 'de', img: 'DE', text: 'Deutsch' },
      { value: 'en', img: 'EN', text: 'English' },
      { value: 'pt', img: 'PT', text: 'Portuguese' },
      { value: 'fr', img: 'FR', text: 'French' },
      { value: 'ar', img: 'AR', text: 'Arabic' },
    ];
  }

  setLanguage(lng) {
    this.translate.use(lng);
    this.selected = lng;
    this.storage.set(LNG_KEY, lng)
  }

  // Apply the language stored on a user account (set at registration or on
  // the profile page), e.g. right after login. Accepts legacy locale-style
  // values ("de_DE") and ignores unsupported or empty codes.
  applyUserLanguage(language: string) {
    if (!language) {
      return;
    }
    const lng = language.toLowerCase().slice(0, 2);
    if (
      this.getLangauges().some((l) => l.value === lng) &&
      lng !== this.selected
    ) {
      this.setLanguage(lng);
    }
  }
}
