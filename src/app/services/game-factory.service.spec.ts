import { TestBed } from '@angular/core/testing';
import { Storage } from '@ionic/storage';

import { GameFactoryService } from './game-factory.service';
import { GameSessionService } from './game-session.service';

describe('GameFactoryService', () => {
  beforeEach(() => TestBed.configureTestingModule({
    providers: [{ provide: Storage, useValue: { remove: () => Promise.resolve() } }],
  }));

  it('should be created', () => {
    const service: GameFactoryService = TestBed.get(GameFactoryService);
    expect(service).toBeTruthy();
  });

  it('keeps a draft while navigating within the app', async () => {
    const service = TestBed.inject(GameFactoryService);
    service.initializeGame();
    service.addGameInformation({ name: 'Session draft' });
    expect((await service.getGame()).name).toBe('Session draft');
  });

  it('does not recover drafts after a new app session', async () => {
    const service = TestBed.inject(GameFactoryService);
    service.initializeGame();
    service.addGameInformation({ name: 'Old draft' });
    const nextSession = new GameFactoryService(new GameSessionService({} as Storage));
    expect((await nextSession.getGame()).name).toBe('');
  });

  it('removes a draft when flushed', async () => {
    const service = TestBed.inject(GameFactoryService);
    service.initializeGame();
    service.addGameInformation({ name: 'Discarded draft' });
    service.flushGame();
    expect((await service.getGame()).name).toBe('');
  });
});
