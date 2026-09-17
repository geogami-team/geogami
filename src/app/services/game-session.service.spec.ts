import { GameSessionService } from './game-session.service';

describe('GameSessionService', () => {
  let persistentStorage: any;
  let service: GameSessionService;

  beforeEach(() => {
    persistentStorage = {
      remove: jasmine.createSpy('remove').and.returnValue(Promise.resolve()),
    };
    service = new GameSessionService(persistentStorage);
  });

  it('keeps snapshots within the running app without writing persistent storage', async () => {
    const progress = { s_Waypoints: [{ lat: 1 }] };
    await service.set('savedTracksData', progress);
    progress.s_Waypoints[0].lat = 2;
    const saved = await service.get('savedTracksData');
    expect(saved.s_Waypoints[0].lat).toBe(1);
    saved.s_Waypoints[0].lat = 3;
    expect((await service.get('savedTracksData')).s_Waypoints[0].lat).toBe(1);
    expect(persistentStorage.remove).not.toHaveBeenCalled();
  });

  it('does not recover drafts or progress in a new app session', async () => {
    await service.set('game', { name: 'Draft' });
    await service.set('savedTracksData', { s_taskNo: 4 });
    const nextSession = new GameSessionService(persistentStorage);
    expect(await nextSession.get('game')).toBeUndefined();
    expect(await nextSession.get('savedTracksData')).toBeUndefined();
  });

  it('removes completed progress without losing the draft', async () => {
    await service.set('game', { name: 'Draft' });
    await service.set('savedTracksData', { s_taskNo: 4 });
    await service.remove('savedTracksData');
    expect(await service.get('savedTracksData')).toBeUndefined();
    expect((await service.get('game')).name).toBe('Draft');
  });

  it('discards only the two legacy progress keys', async () => {
    await service.discardLegacyProgress();
    expect(persistentStorage.remove.calls.allArgs()).toEqual([
      ['game'], ['savedTracksData'],
    ]);
  });

  it('does not block startup if legacy storage cleanup fails', async () => {
    spyOn(console, 'warn');
    persistentStorage.remove.and.callFake(() => Promise.reject(new Error('Denied')));
    await service.discardLegacyProgress();
    expect(console.warn).toHaveBeenCalled();
  });
});
