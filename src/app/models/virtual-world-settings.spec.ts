import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { cloneDeep } from 'lodash';
import { parseCameraFarClipPlane } from './virtual-world-settings';
import { explorationTask } from './navigation-tasks';
import { standardMapFeatures } from './standardMapFeatures';
import { ExplorationTimer } from './exploration-timer';
import { CreateTaskModalPage } from '../pages/create-game/create-task-modal/create-task-modal.page';
import { CreateInfoModalComponent } from '../pages/create-game/create-info-modal/create-info-modal.component';
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

  function editor(type: any, distance: any): any {
    const modal: any = Object.create(type.prototype);
    modal.task = task(distance);
    modal.isVirtualWorld = true;
    modal.virEnvType = 'VirEnv_52';
    modal.isSingleMode = true;
    modal.translate = { instant: (key: string) => key };
    modal.utilService = { showValidationError: jasmine.createSpy('validation') };
    modal.modalController = { dismiss: jasmine.createSpy('dismiss') };
    return modal;
  }

  it('accepts distances and distinguishes defaults from invalid input', () => {
    [undefined, null, '', ' '].forEach(value => {
      expect(parseCameraFarClipPlane(value)).toBeUndefined();
    });
    expect(parseCameraFarClipPlane('250.5')).toBe(250.5);
    expect(parseCameraFarClipPlane(1)).toBe(1);
    [0, -1, 0.5, NaN, Infinity, 1e40, 'invalid', true, [], {}].forEach(value => {
      expect(parseCameraFarClipPlane(value)).toBeNull();
    });
  });

  [CreateTaskModalPage, CreateInfoModalComponent].forEach(type => {
    describe(type.name, () => {
      it('saves a numeric value that survives JSON persistence', () => {
        const modal = editor(type, '250.5');
        modal.dismissModal();
        const saved = JSON.parse(JSON.stringify(modal.modalController.dismiss.calls.mostRecent().args[0].data));
        expect(saved.settings.cameraFarClipPlane).toBe(250.5);
      });

      it('clears an override when the author leaves the field blank', () => {
        const modal = editor(type, '');
        modal.dismissModal();
        const saved = JSON.parse(JSON.stringify(modal.modalController.dismiss.calls.mostRecent().args[0].data));
        expect(saved.settings.cameraFarClipPlane).toBeUndefined();
      });

      it('blocks saving invalid distances', () => {
        [0, -5, Infinity, 'invalid'].forEach(value => {
          const modal = editor(type, value);
          modal.dismissModal();
          expect(modal.modalController.dismiss).not.toHaveBeenCalled();
          expect(modal.utilService.showValidationError).toHaveBeenCalledWith('CreateGame.cameraFarClipPlaneInvalid');
        });
      });
    });
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

    [250, 75.5, undefined].forEach(distance => {
      page.task = task(distance);
      page.initTask();
      flushMicrotasks();
      tick(1000);
      expect(page.socketService.socket.emit.calls.mostRecent().args[1].cameraFarClipPlane).toBe(distance ?? 0);
    });
    page.stopExplorationTimer();
  }));
});
