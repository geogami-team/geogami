import { TestBed } from '@angular/core/testing';
import {
  HttpClientTestingModule,
  HttpTestingController,
} from '@angular/common/http/testing';

import { GamesService } from './games.service';
import { environment } from '../../environments/environment';

describe('GamesService', () => {
  let service: GamesService;
  let http: HttpTestingController;
  const id = '638df27d7ece7c88bff50443';

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    service = TestBed.inject(GamesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  // The server only tells a signed-in co-author that they co-author a game
  // (their own address in `editors`), so these public reads carry the token.
  describe('public game reads', () => {
    const listUrl = (url: string) => url.startsWith(`${environment.apiURL}/game/all/`);

    afterEach(() => window.localStorage.removeItem('bg_accesstoken'));

    it('send the access token when signed in', () => {
      window.localStorage.setItem('bg_accesstoken', 'test-token');
      service.getGames(true, true);
      service.getGame(id);
      const list = http.expectOne((req) => listUrl(req.url));
      const game = http.expectOne(`${environment.apiURL}/game/${id}`);
      expect(list.request.headers.get('Authorization')).toBe('Bearer test-token');
      expect(game.request.headers.get('Authorization')).toBe('Bearer test-token');
      list.flush({ content: [] });
      game.flush({ content: { _id: id } });
    });

    it('send no Authorization header when signed out', () => {
      window.localStorage.removeItem('bg_accesstoken');
      service.getGames(true, false);
      service.getGame(id);
      const list = http.expectOne((req) => listUrl(req.url));
      const game = http.expectOne(`${environment.apiURL}/game/${id}`);
      expect(list.request.headers.has('Authorization')).toBeFalse();
      expect(game.request.headers.has('Authorization')).toBeFalse();
      list.flush({ content: [] });
      game.flush({ content: { _id: id } });
    });
  });

  describe('findGame', () => {
    it('returns the game when the API has it', async () => {
      const lookup = service.findGame(id);
      http
        .expectOne(`${environment.apiURL}/game/${id}`)
        .flush({ content: { _id: id, name: 'Campus walk' } });
      expect(await lookup).toEqual({
        state: 'found',
        game: { _id: id, name: 'Campus walk' },
      });
    });

    it('reports notFound for a deleted or unknown game (404)', async () => {
      const lookup = service.findGame(id);
      http
        .expectOne(`${environment.apiURL}/game/${id}`)
        .flush({ message: 'Game was not found.', content: null }, { status: 404, statusText: 'Not Found' });
      expect(await lookup).toEqual({ state: 'notFound' });
    });

    it('reports notFound for a missing or malformed id without calling the API', async () => {
      for (const bad of [undefined, '', 'abc', `${id}x`, 'zzzzzzzzzzzzzzzzzzzzzzzz']) {
        expect(await service.findGame(bad)).toEqual({ state: 'notFound' });
      }
      http.expectNone(() => true);
    });

    it('reports error (not notFound) when the request fails', async () => {
      const offline = service.findGame(id);
      http
        .expectOne(`${environment.apiURL}/game/${id}`)
        .error(new ErrorEvent('Network error'), { status: 0 });
      expect(await offline).toEqual({ state: 'error' });

      const serverDown = service.findGame(id);
      http
        .expectOne(`${environment.apiURL}/game/${id}`)
        .flush('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
      expect(await serverDown).toEqual({ state: 'error' });
    });
  });
});
