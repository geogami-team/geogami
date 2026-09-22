import { TranslateService } from '@ngx-translate/core';
import { Injectable } from '@angular/core';
import { Storage } from '@ionic/storage';

const LNG_KEY = 'SELECTED_LANGUAGE';
const lngs = ['de', 'en', 'it', 'pt', 'fr', 'ar'];

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
      } else {
        const browserLanguage = (this.translate.getBrowserCultureLang() || '')
          .toLowerCase()
          .slice(0, 2);
        if (lngs.includes(browserLanguage)) {
          this.translate.setDefaultLang(browserLanguage);
          this.setLanguage(browserLanguage);
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
      { value: 'it', img: 'IT', text: 'Italiano' },
      { value: 'pt', img: 'PT', text: 'Português' },
      { value: 'fr', img: 'FR', text: 'Français' },
      { value: 'ar', img: 'AR', text: 'العربية' },
    ];
  }

  setLanguage(lng: string) {
    const normalizedLanguage = (lng || '').toLowerCase().slice(0, 2);
    if (!lngs.includes(normalizedLanguage)) {
      return;
    }

    this.translate.use(normalizedLanguage);
    this.selected = normalizedLanguage;
    this.applyDocumentLocale(normalizedLanguage);
    this.storage.set(LNG_KEY, normalizedLanguage)
  }

  private applyDocumentLocale(lng: string) {
    if (typeof document === 'undefined') {
      return;
    }

    document.documentElement.lang = lng;
    document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr';
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
