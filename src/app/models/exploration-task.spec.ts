import { fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { cloneDeep } from 'lodash';
import { ExplorationTimer } from './exploration-timer';
import { explorationTask, navtasks } from './navigation-tasks';
import { navtasksMultiplayers2 } from './navigation-tasks-multi_2_players';
import { navtasksMultiplayers3 } from './navigation-tasks-multi_3_players';
import { standardMapFeatures } from './standardMapFeatures';
import { CreateTaskModalPage } from '../pages/create-game/create-task-modal/create-task-modal.page';
import { PlayingGamePage } from '../pages/play-game/playing-game/playing-game.page';

describe('Exploration tasks', () => {
  afterEach(() => { PlayingGamePage.showSuccess = false; });

  function editor(): any {
    const modal: any = Object.create(CreateTaskModalPage.prototype);
    modal.task = cloneDeep(explorationTask);
    modal.isSingleMode = true;
    modal.mapFeatures = cloneDeep(standardMapFeatures);
    modal.translate = { instant: (key: string) => key };
    modal.utilService = { showValidationError: jasmine.createSpy('validation') };
    modal.modalController = { dismiss: jasmine.createSpy('dismiss') };
    modal.task.question.text = 'Explore the environment.';
    return modal;
  }

  function player(): any {
    const page: any = Object.create(PlayingGamePage.prototype);
    page.task = { ...cloneDeep(explorationTask), mapFeatures: cloneDeep(standardMapFeatures) };
    page.game = { tasks: [page.task] };
    page.taskIndex = 0;
    page.taskInitialization = 0;
    page.isSingleMode = true;
    page.explorationTimer = new ExplorationTimer();
    page.showExplorationTimeOver = false;
    page.changeDetectorRef = { detectChanges: () => {} };
    page.trackerService = { addEvent: jasmine.createSpy('event'), setTask: () => {} };
    return page;
  }

  it('offers exploration in single-player and multiplayer navigation lists without destinations', () => {
    expect(navtasks.find(task => task.type === 'nav-exploration')).toBeTruthy();
    [navtasksMultiplayers2, navtasksMultiplayers3].forEach((tasks, index) => {
      const task = tasks.find(t => t.type === 'nav-exploration');
      expect(task.question.length).toBe(index + 2);
      expect(task.answer.length).toBe(index + 2);
      expect(task.answer.every(answer => answer.position === undefined)).toBe(true);
      expect(task.question[0]).not.toBe(task.question[1]);
    });
  });

  it('saves the instruction and timer settings without a destination', () => {
    const modal = editor();
    modal.task.settings.durationSeconds = '90';
    modal.task.settings.showTimer = false;
    modal.dismissModal();
    expect(modal.utilService.showValidationError).not.toHaveBeenCalled();
    expect(modal.modalController.dismiss).toHaveBeenCalledWith(jasmine.objectContaining({
      data: jasmine.objectContaining({
        settings: jasmine.objectContaining({ durationSeconds: 90, showTimer: false })
      })
    }));
  });

  it('rejects empty, nonpositive, fractional and nonfinite durations', () => {
    ['', null, 0, -1, 1.5, NaN, Infinity].forEach(duration => {
      const modal = editor();
      modal.task.settings.durationSeconds = duration;
      modal.dismissModal();
      expect(modal.modalController.dismiss).not.toHaveBeenCalled();
      expect(modal.utilService.showValidationError).toHaveBeenCalledWith(
        'CreateGame.explorationDurationRequired'
      );
    });
  });

  it('requires an exploration instruction', () => {
    const modal = editor();
    modal.task.question.text = '';
    modal.dismissModal();
    expect(modal.modalController.dismiss).not.toHaveBeenCalled();
  });

  it('disables flag, confirmation and scoring settings while preserving timer visibility', () => {
    const modal = editor();
    Object.assign(modal.task.settings, { showMarker: true, confirmation: true, feedback: true, showTimer: false });
    modal.settingsChange();
    expect(modal.task.settings.showMarker).toBe(false);
    expect(modal.task.settings.keepMarker).toBe(false);
    expect(modal.task.settings.confirmation).toBe(false);
    expect(modal.task.settings.feedback).toBe(false);
    expect(modal.task.settings.showTimer).toBe(false);
    expect(modal.showFeedback).toBe(false);
  });

  it('counts down and completes exactly once', fakeAsync(() => {
    const timer = new ExplorationTimer();
    const complete = jasmine.createSpy('complete');
    timer.start(65, () => {}, complete);
    expect(timer.display).toBe('1:05');
    tick(1000);
    expect(timer.display).toBe('1:04');
    tick(64000);
    expect(timer.display).toBe('0:00');
    expect(complete).toHaveBeenCalledTimes(1);
    tick(10000);
    expect(complete).toHaveBeenCalledTimes(1);
  }));

  it('uses elapsed wall time when browser callbacks are delayed', fakeAsync(() => {
    const timer = new ExplorationTimer();
    const complete = jasmine.createSpy('complete');
    timer.start(60, () => {}, complete);
    const now = Date.now();
    spyOn(Date, 'now').and.returnValue(now + 60000);
    tick(1000);
    expect(complete).toHaveBeenCalledTimes(1);
  }));

  it('cancels the previous countdown when another one starts', fakeAsync(() => {
    const timer = new ExplorationTimer();
    const oldComplete = jasmine.createSpy('old');
    const newComplete = jasmine.createSpy('new');
    timer.start(2, () => {}, oldComplete);
    tick(1000);
    timer.start(3, () => {}, newComplete);
    tick(2000);
    expect(oldComplete).not.toHaveBeenCalled();
    expect(newComplete).not.toHaveBeenCalled();
    tick(1000);
    expect(newComplete).toHaveBeenCalledTimes(1);
  }));

  [true, false].forEach(showTimer => {
    it(`shows an expiry panel before advancing with showTimer=${showTimer}`, fakeAsync(() => {
      const page = player();
      page.task.settings.durationSeconds = 2;
      page.task.settings.showTimer = showTimer;
      spyOn(page, 'nextTask');
      page.startExplorationTimer();
      tick(1000);
      expect(page.nextTask).not.toHaveBeenCalled();
      tick(1000);
      expect(page.showExplorationTimeOver).toBe(true);
      expect(page.nextTask).not.toHaveBeenCalled();
      expect(page.trackerService.addEvent).toHaveBeenCalledWith({ type: 'EXPLORATION_COMPLETED' });
      tick(2999);
      expect(page.nextTask).not.toHaveBeenCalled();
      tick(1);
      expect(page.nextTask).toHaveBeenCalledTimes(1);
      tick(5000);
      expect(page.nextTask).toHaveBeenCalledTimes(1);
    }));
  });

  it('cancels countdowns on task changes and page destruction', fakeAsync(() => {
    const page = player();
    page.task.settings.durationSeconds = 2;
    spyOn(page, 'nextTask');
    page.startExplorationTimer();
    page.stopExplorationTimer();
    tick(2000);
    expect(page.nextTask).not.toHaveBeenCalled();
    page.startExplorationTimer();
    page.ngOnDestroy();
    tick(2000);
    expect(page.nextTask).not.toHaveBeenCalled();
  }));

  it('cancels the old countdown when manually moving to the next task', fakeAsync(() => {
    const page = player();
    const next = { type: 'info', category: 'info', settings: {}, answer: { type: 'INFO' } };
    page.game.tasks.push(next);
    page.task.settings.durationSeconds = 2;
    page.feedbackControl = { setTask: jasmine.createSpy('feedback') };
    page.trackerService.updateTaskNo = jasmine.createSpy('task number');
    spyOn(page, 'initTask');
    page.startExplorationTimer();
    page.nextTask();
    tick(2000);
    expect(page.task).toBe(next);
    expect(page.taskIndex).toBe(1);
    expect(page.initTask).toHaveBeenCalledTimes(1);
    expect(page.trackerService.addEvent).not.toHaveBeenCalled();
  }));

  it('finishes the game when its last exploration task expires', fakeAsync(() => {
    const page = player();
    page.task.settings.durationSeconds = 1;
    page.enableDisableMapInteraction = jasmine.createSpy('interactions');
    page.startExplorationTimer();
    tick(1000);
    expect(page.showExplorationTimeOver).toBe(true);
    expect(PlayingGamePage.showSuccess).toBe(false);
    tick(3000);
    expect(page.showExplorationTimeOver).toBe(false);
    expect(PlayingGamePage.showSuccess).toBe(true);
    expect(page.trackerService.addEvent).toHaveBeenCalledWith({ type: 'FINISHED_GAME' });
    expect(page.enableDisableMapInteraction).toHaveBeenCalledWith(false);
  }));

  it('dismisses the expiry panel and cancels progression when the page is destroyed', fakeAsync(() => {
    const page = player();
    page.task.settings.durationSeconds = 1;
    spyOn(page, 'nextTask');
    page.startExplorationTimer();
    tick(1000);
    expect(page.showExplorationTimeOver).toBe(true);
    page.ngOnDestroy();
    expect(page.showExplorationTimeOver).toBe(false);
    tick(3000);
    expect(page.nextTask).not.toHaveBeenCalled();
  }));

  it('cancels delayed progression if another task is selected during the expiry panel', fakeAsync(() => {
    const page = player();
    const next = { type: 'info', category: 'info', settings: {}, answer: { type: 'INFO' } };
    page.game.tasks.push(next);
    page.task.settings.durationSeconds = 1;
    page.feedbackControl = { setTask: () => {} };
    page.trackerService.updateTaskNo = () => {};
    spyOn(page, 'initTask');
    page.startExplorationTimer();
    tick(1000);
    expect(page.showExplorationTimeOver).toBe(true);
    page.nextTask();
    expect(page.showExplorationTimeOver).toBe(false);
    tick(3000);
    expect(page.task).toBe(next);
    expect(page.taskIndex).toBe(1);
    expect(page.initTask).toHaveBeenCalledTimes(1);
    expect(PlayingGamePage.showSuccess).toBe(false);
  }));

  it('does not start a countdown if the page leaves during task initialization', fakeAsync(() => {
    const page = player();
    page.map = { getLayer: () => null, getSource: () => null, hasControl: () => false,
      setPitch: () => {}, rotateTo: () => {} };
    page.landmarkControl = { removeQT: () => {}, removeSearchArea: () => {} };
    page.geolocateControl = { setType: () => {} };
    page.zoomBounds = () => Promise.resolve();
    let finishMapInitialization: () => void;
    page._initMapFeatures = () => new Promise<void>(resolve => { finishMapInitialization = resolve; });
    spyOn(page, 'startExplorationTimer');
    page.initTask();
    page.ngOnDestroy();
    finishMapInitialization();
    flushMicrotasks();
    expect(page.startExplorationTimer).not.toHaveBeenCalled();
  }));
});
