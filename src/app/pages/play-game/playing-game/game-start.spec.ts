import { fakeAsync, tick } from '@angular/core/testing';

import { PlayingGamePage } from './playing-game.page';

// When a game starts. The map loading, this player's own number arriving and
// other players joining can happen in any order; the game must start exactly
// once, as soon as the map is ready and (multiplayer) the group is complete.
// Only the page's start check runs here, on a stand-in for the page.

describe('PlayingGamePage start check', () => {
  type Page = Record<string, any>;

  function page(state: Page): Page {
    const p: Page = {
      isSingleMode: false,
      isRejoin: false,
      numPlayers: 2,
      joinedPlayersCount: 0,
      playerAssigned: false,
      mapLoaded: false,
      gameStarted: false,
      waitPlayersPanel: true,
      startGame: jasmine.createSpy('startGame'),
      ...state,
    };
    return p;
  }
  const check = (p: Page) => PlayingGamePage.prototype.startGameWhenReady.call(p);
  const leave = (p: Page) => PlayingGamePage.prototype.cancelPendingStart.call(p);

  // The events the page acts on, as its handlers record them.
  const mapLoads = (p: Page) => { p.mapLoaded = true; check(p); };
  const assigned = (p: Page, playerNo: number) => {
    p.playerNo = p.joinedPlayersCount = playerNo;
    p.playerAssigned = true;
    check(p);
  };
  const playerJoined = (p: Page, count: number) => { p.joinedPlayersCount = count; check(p); };

  it('starts the last player when their number arrives after the map has loaded', fakeAsync(() => {
    const p = page({});
    mapLoads(p);
    tick(1000);
    expect(p.startGame).not.toHaveBeenCalled();
    assigned(p, 2); // the last of 2: there is no "player joined" for themselves
    tick(200);
    expect(p.startGame).toHaveBeenCalledTimes(1);
    expect(p.waitPlayersPanel).toBeFalse();
  }));

  it('starts the last player when the map loads after their number', fakeAsync(() => {
    const p = page({});
    assigned(p, 2);
    tick(1000);
    expect(p.startGame).not.toHaveBeenCalled();
    mapLoads(p);
    tick(200);
    expect(p.startGame).toHaveBeenCalledTimes(1);
  }));

  it('starts an earlier player when the group completes, but not before the map is ready', fakeAsync(() => {
    const p = page({});
    assigned(p, 1);
    playerJoined(p, 2);
    tick(1000);
    expect(p.startGame).not.toHaveBeenCalled();
    mapLoads(p);
    tick(200);
    expect(p.startGame).toHaveBeenCalledTimes(1);
  }));

  it('waits until the group is complete', fakeAsync(() => {
    const p = page({ numPlayers: 3 });
    mapLoads(p);
    assigned(p, 1);
    playerJoined(p, 2);
    tick(1000);
    expect(p.startGame).not.toHaveBeenCalled();
    playerJoined(p, 3);
    tick(200);
    expect(p.startGame).toHaveBeenCalledTimes(1);
  }));

  it('starts only once, whatever arrives later', fakeAsync(() => {
    const p = page({});
    mapLoads(p);
    assigned(p, 2);
    playerJoined(p, 2);
    assigned(p, 2); // the number sent again
    mapLoads(p);
    tick(1000);
    expect(p.startGame).toHaveBeenCalledTimes(1);
  }));

  it('never starts after the player has left', fakeAsync(() => {
    const p = page({});
    mapLoads(p);
    assigned(p, 2); // ready: the start is pending
    leave(p); // e.g. the app went to the background, or back was pressed
    tick(1000);
    expect(p.startGame).not.toHaveBeenCalled();
    leave(p); // leaving twice is fine
  }));

  it('starts a single-player game when the map has loaded', fakeAsync(() => {
    const p = page({ isSingleMode: true });
    check(p);
    tick(1000);
    expect(p.startGame).not.toHaveBeenCalled();
    mapLoads(p);
    tick(200);
    expect(p.startGame).toHaveBeenCalledTimes(1);
  }));

  it('starts a resumed player once the map has loaded and the group is complete', fakeAsync(() => {
    // A resumed player has their number from the saved session, not from the server.
    const p = page({ isRejoin: true, joinedPlayersCount: 2 });
    mapLoads(p);
    tick(200);
    expect(p.startGame).toHaveBeenCalledTimes(1);
  }));
});
