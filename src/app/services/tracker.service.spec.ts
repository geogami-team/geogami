import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { TrackerService } from './tracker.service';
import { OrigamiGeolocationService } from './origami-geolocation.service';
import { OrigamiOrientationService } from './origami-orientation.service';

describe('TrackerService', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      // The device sensors aren't needed to build an upload.
      providers: [
        { provide: OrigamiGeolocationService, useValue: {} },
        { provide: OrigamiOrientationService, useValue: {} },
      ],
    })
  );

  it('should be created', () => {
    const service: TrackerService = TestBed.inject(TrackerService);
    expect(service).toBeTruthy();
  });

  // What the app sends when a play ends. In a multiplayer game the server
  // only takes a player's part with the key it gave that player on joining.
  describe('uploading a play', () => {
    let service: TrackerService;
    let sent: jasmine.Spy;

    // A play in progress, as init() leaves it (without starting location watches).
    function playing(state: { isSingleMode: boolean; playerKey?: string }) {
      Object.assign(service as any, {
        game: '65b000000000000000000001',
        gameName: 'Group game',
        start: '2026-11-26T10:00:00.000Z',
        players: ['Anna'],
        waypoints: [{ marker: 1 }],
        events: [{ type: 'FINISHED_GAME' }],
        device: { platform: 'web' },
        numPlayers: 3,
        playerNo: 2,
        playerKey: null,
        isVirtualWorld: false,
        positionWatch: { unsubscribe: () => {} },
        deviceOrientationSubscription: { unsubscribe: () => {} },
        ...state,
      });
    }

    beforeEach(() => {
      service = TestBed.inject(TrackerService);
      sent = spyOn(service, 'storeMultiplayerTracks').and.returnValue(Promise.resolve({ status: 201 }) as any);
    });

    it('sends the player key with the first upload of a group', async () => {
      playing({ isSingleMode: false, playerKey: 'session.2.signature' });
      await service.uploadTrack();
      const [data, isStored] = sent.calls.mostRecent().args;
      expect(isStored).toBeFalse();
      expect(data.playerKey).toBe('session.2.signature');
      expect(JSON.parse(JSON.stringify(data.players))).toEqual([null, 'Anna', null]);
    });

    it('sends the player key and slot when adding a part to the group\'s track', async () => {
      playing({ isSingleMode: false, playerKey: 'session.2.signature' });
      await service.uploadTrack(true, '65b0000000000000000000aa');
      const [data, isStored] = sent.calls.mostRecent().args;
      expect(isStored).toBeTrue();
      expect(data._id).toBe('65b0000000000000000000aa');
      expect(data.playerNo).toBe(2);
      expect(data.playerKey).toBe('session.2.signature');
    });

    it('sends no key when the server gave none', async () => {
      playing({ isSingleMode: false, playerKey: null });
      await service.uploadTrack(true, '65b0000000000000000000aa');
      expect('playerKey' in JSON.parse(JSON.stringify(sent.calls.mostRecent().args[0]))).toBeFalse();
    });

    it('never sends a key with a single-player play', async () => {
      playing({ isSingleMode: true, playerKey: 'left.over.key' });
      await service.uploadTrack();
      expect(sent.calls.mostRecent().args[0].playerKey).toBeUndefined();
    });
  });
});
