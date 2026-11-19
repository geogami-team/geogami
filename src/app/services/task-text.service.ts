import { Injectable } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { forkJoin, of } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';
import { LanguageService } from './language.service';

// Players are often outdoors on a weak connection: never hold up a game start
// for longer than this. On a timeout the stored texts are shown unchanged.
const LOAD_TIMEOUT_MS = 5000;

type DefaultTexts = { [language: string]: { [key: string]: string } };

// A default task instruction is written into the game in the author's language
// when the task is saved, so the stored text ignores the language the player
// selected. This swaps a text that still equals a default for the same default
// in the player's language. The text is matched against every language rather
// than through `question.key`, because games from before July 2025 hold German
// defaults without a key. Text the author wrote is left as it is.
@Injectable({
  providedIn: 'root'
})
export class TaskTextService {
  private defaultTexts: Promise<DefaultTexts>;

  constructor(
    private translate: TranslateService,
    private languageService: LanguageService
  ) { }

  async localizeGame(game: any) {
    const language = this.languageService.selected;
    if (!language || !game?.tasks?.length) {
      return game;
    }

    const defaults = await this.loadDefaultTexts();
    const target = defaults[language];
    if (!target) {
      return game;
    }

    const keyByText = new Map<string, string>();
    Object.values(defaults).forEach((texts) =>
      Object.keys(texts).forEach((key) => keyByText.set(texts[key].trim(), key))
    );

    game.tasks.forEach((task: any) => {
      // an array in multiplayer games, one question per player
      [].concat(task.question ?? []).forEach((question: any) => {
        const key = keyByText.get(question?.text?.trim());
        if (key && target[key]) {
          question.text = target[key];
        }
      });
    });

    return game;
  }

  // Goes through the loader, not TranslateService.getTranslation, which would
  // also touch the state of the language switch that may be in progress.
  private loadDefaultTexts(): Promise<DefaultTexts> {
    if (!this.defaultTexts) {
      const languages = this.languageService.getLangauges().map((l) => l.value);

      this.defaultTexts = forkJoin(
        languages.map((language) =>
          this.translate.currentLoader.getTranslation(language).pipe(
            timeout(LOAD_TIMEOUT_MS),
            catchError(() => of(null))
          )
        )
      )
        .toPromise()
        .then((files: any[]) => {
          if (files.some((file) => !file)) {
            this.defaultTexts = undefined; // try again on the next game
          }

          const defaults: DefaultTexts = {};
          files.forEach((file, i) => {
            if (file?.QuestionText) {
              defaults[languages[i]] = file.QuestionText;
            }
          });
          return defaults;
        });
    }

    return this.defaultTexts;
  }
}
