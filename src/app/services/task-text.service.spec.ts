import { of, throwError } from 'rxjs';
import { TaskTextService } from './task-text.service';

describe('TaskTextService', () => {
  const files = {
    de: { QuestionText: { goToFlag: 'Gehe zur Fahne.', whereAreYouNow: 'Wo bist du jetzt?' } },
    en: { QuestionText: { goToFlag: 'Go to the flag.', whereAreYouNow: 'Where are you now?' } },
    fr: { QuestionText: { goToFlag: 'Allez au drapeau.', whereAreYouNow: 'Où êtes-vous ?' } },
  };

  function createService(selected: string, loadFile = (lng: string) => of(files[lng])) {
    const getTranslation = jasmine.createSpy('getTranslation').and.callFake(loadFile);
    const languageService = {
      selected,
      getLangauges: () => Object.keys(files).map((value) => ({ value })),
    };
    const service = new TaskTextService(
      { currentLoader: { getTranslation } } as any,
      languageService as any
    );
    return { service, getTranslation };
  }

  it('shows an unedited default in the selected language, not the one it was saved in', async () => {
    const { service } = createService('de');
    const game = {
      tasks: [{ question: { key: 'QuestionText.goToFlag', text: 'Go to the flag.' } }],
    };

    await service.localizeGame(game);

    expect(game.tasks[0].question.text).toBe('Gehe zur Fahne.');
  });

  it('recognises German defaults of old games that have no key', async () => {
    const { service } = createService('en');
    const game = { tasks: [{ question: { text: 'Gehe zur Fahne.' } }] };

    await service.localizeGame(game);

    expect(game.tasks[0].question.text).toBe('Go to the flag.');
  });

  it('ignores surrounding whitespace when matching a default', async () => {
    const { service } = createService('fr');
    const game = { tasks: [{ question: { text: '  Go to the flag.\n' } }] };

    await service.localizeGame(game);

    expect(game.tasks[0].question.text).toBe('Allez au drapeau.');
  });

  it('keeps text the author wrote, even with a default key', async () => {
    const { service } = createService('de');
    const game = {
      tasks: [{ question: { key: 'QuestionText.goToFlag', text: 'Go to the old church.' } }],
    };

    await service.localizeGame(game);

    expect(game.tasks[0].question.text).toBe('Go to the old church.');
  });

  it('localizes every player question of a multiplayer task', async () => {
    const { service } = createService('de');
    const game = {
      tasks: [{
        question: [
          { text: 'Go to the flag.' },
          { text: 'Where are you now?' },
          { text: 'Custom text' },
        ],
      }],
    };

    await service.localizeGame(game);

    expect(game.tasks[0].question.map((q) => q.text)).toEqual([
      'Gehe zur Fahne.',
      'Wo bist du jetzt?',
      'Custom text',
    ]);
  });

  it('copes with tasks that have no question or no text', async () => {
    const { service } = createService('de');
    const game = { tasks: [{}, { question: {} }, { question: [null, { text: '' }] }] };

    await expectAsync(service.localizeGame(game)).toBeResolved();
  });

  it('leaves the game unchanged until a language is selected', async () => {
    const { service, getTranslation } = createService('');
    const game = { tasks: [{ question: { text: 'Go to the flag.' } }] };

    await service.localizeGame(game);

    expect(game.tasks[0].question.text).toBe('Go to the flag.');
    expect(getTranslation).not.toHaveBeenCalled();
  });

  it('still starts the game when a language file fails to load, and retries next time', async () => {
    let online = false;
    const { service } = createService('de', (lng) =>
      online || lng !== 'de' ? of(files[lng]) : throwError(new Error('offline'))
    );

    const first = { tasks: [{ question: { text: 'Go to the flag.' } }] };
    await service.localizeGame(first);
    expect(first.tasks[0].question.text).toBe('Go to the flag.');

    online = true;
    const second = { tasks: [{ question: { text: 'Go to the flag.' } }] };
    await service.localizeGame(second);
    expect(second.tasks[0].question.text).toBe('Gehe zur Fahne.');
  });

  it('loads the language files only once', async () => {
    const { service, getTranslation } = createService('de');

    await service.localizeGame({ tasks: [{ question: { text: 'x' } }] });
    await service.localizeGame({ tasks: [{ question: { text: 'y' } }] });

    expect(getTranslation).toHaveBeenCalledTimes(Object.keys(files).length);
  });
});
