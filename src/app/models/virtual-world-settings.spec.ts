import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { cloneDeep } from 'lodash';
import { parseCameraFarClipPlane } from './virtual-world-settings';
import { explorationTask } from './navigation-tasks';
import { standardMapFeatures } from './standardMapFeatures';
import { ExplorationTimer } from './exploration-timer';
import { PlayingGamePage } from '../pages/play-game/playing-game/playing-game.page';

describe('Virtual world camera clipping distance', () => {
  function task(distance?: any): any {
    const result: any = cloneDeep(explorationTask);
    result.question.text = 'Explore the environment.';
    result.settings.cameraFarClipPlane = distance;
    result.mapFeatures = cloneDeep(standardMapFeatures);
    result.excludedObjectsNames = [];
    result.virEnvType = 'VirEnv_52';
    return result;
  }

  it('uses the camera default for unset or unusable values', () => {
    [undefined, null, '', ' ', 'invalid', NaN, Infinity, true, [], {}].forEach(value => {
      expect(parseCameraFarClipPlane(value)).toBeUndefined();
    });
  });

  it('keeps distances within the slider range and clamps the rest', () => {
    expect(parseCameraFarClipPlane(100)).toBe(100);
    expect(parseCameraFarClipPlane('250.5')).toBe(250.5);
    expect(parseCameraFarClipPlane(1000)).toBe(1000);
    expect(parseCameraFarClipPlane(0)).toBe(100);
    expect(parseCameraFarClipPlane(-5)).toBe(100);
    expect(parseCameraFarClipPlane(5000)).toBe(1000);
  });

  function player(): any {
    const page: any = Object.create(PlayingGamePage.prototype);
    page.task = task(250);
    page.virEnvType = 'VirEnv_52';
    page.playersNames = ['player'];
    page.isSingleMode = true;
    page.isVirtualWorld = true;
    page.socketService = {
      creatAndJoinNewRoom: () => {},
      socket: { connect: () => {}, on: jasmine.createSpy('on'), emit: jasmine.createSpy('emit') }
    };
    return page;
  }

  [false, true].forEach(hasLastPosition => {
    it(`sends the current override on initial/reconnect requests (cached position: ${hasLastPosition})`, () => {
      const page = player();
      if (hasLastPosition) page.avatarLastKnownPosition = { coords: { longitude: 0, latitude: 0 } };
      page.connectSocketIO(page.task);
      const request = page.socketService.socket.on.calls.mostRecent().args[1];
      request();
      expect(page.socketService.socket.emit.calls.mostRecent().args[1].cameraFarClipPlane).toBe(250);
      page.task = task();
      request();
      expect(page.socketService.socket.emit.calls.mostRecent().args[1].cameraFarClipPlane).toBe(0);
    });
  });

  it('sends the new distance on task changes and resets old tasks without the setting', fakeAsync(() => {
    const page = player();
    page.game = { tasks: [page.task] };
    page.taskIndex = 0;
    page.taskInitialization = 0;
    page.explorationTimer = new ExplorationTimer();
    page.trackerService = { setTask: () => {}, addEvent: () => {} };
    page.changeDetectorRef = { detectChanges: () => {} };
    page.map = { getLayer: () => null, getSource: () => null, hasControl: () => false,
      setPitch: () => {}, rotateTo: () => {} };
    page.landmarkControl = { removeQT: () => {}, removeSearchArea: () => {} };
    page.geolocateControl = { setType: () => {} };
    page.zoomBounds = () => Promise.resolve();
    page._initMapFeatures = () => Promise.resolve();
    page.setAvatarInitialPosition = () => [0, 0];
    page.setAvatarInitialRotation = () => 0;
    page.setAvatarInitialHeight = () => 100;
    page.startExplorationTimer = () => {};

    [[250, 250], [5000, 1000], [undefined, 0]].forEach(([distance, sent]) => {
      page.task = task(distance);
      page.initTask();
      flushMicrotasks();
      tick(1000);
      expect(page.socketService.socket.emit.calls.mostRecent().args[1].cameraFarClipPlane).toBe(sent);
    });
    page.stopExplorationTimer();
  }));
});
