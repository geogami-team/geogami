import { FeedbackComponent } from './feedback.component';
import { AnswerType, QuestionType } from '../../models/types';
import { PlayingGamePage } from '../../pages/play-game/playing-game/playing-game.page';

describe('Direction-determination feedback', () => {
  // First task in "Copy of Study_TrainingPhase -test" (6ac77de3e76fa20f397d3a39).
  const studyBearing = 190.9540626379309;
  let component: any;
  let inputs: any;

  beforeEach(() => {
    component = new FeedbackComponent(
      null,
      { detectChanges: () => {} } as any,
      null,
      { instant: (key: string) => key } as any,
      null
    );
    component.task = {
      type: 'theme-direction',
      question: {
        type: QuestionType.MAP_DIRECTION_PHOTO,
        direction: { bearing: studyBearing }
      },
      answer: { type: AnswerType.DIRECTION },
      settings: { feedback: true, multipleTries: true }
    };
    component.trackerService = { addEvent: jasmine.createSpy('event') };
    component.toastController = {
      create: jasmine.createSpy('toast').and.returnValue(Promise.resolve({ present: () => {} }))
    };
    component.map = { addSource: jasmine.createSpy('source'), addLayer: jasmine.createSpy('layer') };
    component.isVirtualWorld = true;
    component.avatarLastKnownPosition = { coords: { longitude: 1, latitude: 2 } };
    spyOn(component, 'initFeedback');
    inputs = { compassHeading: studyBearing, directionBearing: 0, clickDirection: null };
  });

  async function expectCorrect(correct: boolean) {
    await component.setAnswer(inputs);
    expect(component.initFeedback).toHaveBeenCalledWith(correct, jasmine.objectContaining({
      compassHeading: inputs.compassHeading,
      clickDirection: inputs.clickDirection
    }));
    expect(component.trackerService.addEvent).toHaveBeenCalledWith(jasmine.objectContaining({
      type: 'ON_OK_CLICKED', correct, answer: jasmine.objectContaining({ correct })
    }));
    expect(component.getMapClickAnswer(inputs, [1, 2]).correct).toBe(correct);
  }

  it('accepts the stored study direction even when the page bearing is still zero', async () => {
    await expectCorrect(true);
  });

  it('rejects north for the study task instead of accepting the default bearing', async () => {
    inputs.compassHeading = 0;
    await expectCorrect(false);
  });

  it('does not grade against a previous task bearing', async () => {
    inputs.directionBearing = 90;
    inputs.compassHeading = 90;
    await expectCorrect(false);
  });

  [QuestionType.MAP_DIRECTION, QuestionType.MAP_DIRECTION_MARKER, QuestionType.MAP_DIRECTION_PHOTO]
    .forEach(questionType => {
      it(`uses the stored target for ${questionType} orientation answers`, async () => {
        component.task.question.type = questionType;
        await expectCorrect(true);
      });
    });

  [AnswerType.DIRECTION, AnswerType.MAP_DIRECTION].forEach(answerType => {
    [0, 360, -360, 720].forEach(bearing => {
      it(`handles north across 360 degrees for ${answerType} with target ${bearing}`, async () => {
        component.task.answer.type = answerType;
        component.task.question.direction.bearing = bearing;
        inputs.compassHeading = 350;
        inputs.clickDirection = 350;
        await expectCorrect(true);
      });
    });

    [25, 30, 31, 180].forEach(error => {
      it(`uses the same 30-degree tolerance for ${answerType} at ${error} degrees error`, async () => {
        component.task.answer.type = answerType;
        component.task.question.direction.bearing = 90;
        inputs.compassHeading = 90 + error;
        inputs.clickDirection = 90 + error;
        await expectCorrect(error <= 30);
      });
    });
  });

  it('accepts a map answer pointing exactly north', async () => {
    component.task.answer.type = AnswerType.MAP_DIRECTION;
    component.task.question.direction.bearing = 0;
    inputs.clickDirection = 0;
    await expectCorrect(true);
  });

  it('requires a map selection and distinguishes it from a zero-degree answer', async () => {
    component.task.answer.type = AnswerType.MAP_DIRECTION;
    await component.setAnswer(inputs);
    expect(component.toastController.create).toHaveBeenCalled();
    expect(component.initFeedback).not.toHaveBeenCalled();
    expect(component.getMapClickAnswer(inputs, [1, 2]).correct).toBe(false);
  });

  it('compares a current-view map answer to the player heading', async () => {
    component.task.answer.type = AnswerType.MAP_DIRECTION;
    component.task.question.type = QuestionType.TEXT;
    inputs.compassHeading = 350;
    inputs.clickDirection = 0;
    await expectCorrect(true);
  });

  it('bases orientation hints on the submitted heading instead of a map click', () => {
    inputs.compassHeading = studyBearing + 40;
    inputs.clickDirection = 0;
    component.showHint(inputs);
    expect(component.feedback.hint).toBe('Feedback.directionRight');
  });

  it('uses the same north target and shortest angle for map hints', () => {
    component.task.answer.type = AnswerType.MAP_DIRECTION;
    component.task.question.direction.bearing = 0;
    inputs.compassHeading = 180;
    inputs.clickDirection = 320;
    component.showHint(inputs);
    expect(component.feedback.hint).toBe('Feedback.directionRight');
  });

  [AnswerType.DIRECTION, AnswerType.MAP_DIRECTION].forEach(answerType => {
    it(`shows the configured photo direction as the solution for ${answerType}`, () => {
      component.task.answer.type = answerType;
      component.direction = 90;
      component.showSolution();
      expect(component.map.addLayer).toHaveBeenCalledWith(jasmine.objectContaining({
        layout: jasmine.objectContaining({
          'icon-rotate': studyBearing, 'icon-rotation-alignment': 'map'
        })
      }));
    });
  });

  it('initializes photo bearings on every task and clears the previous map selection', async () => {
    const page: any = Object.create(PlayingGamePage.prototype);
    Object.assign(page, {
      task: { ...component.task, mapFeatures: {} },
      game: { tasks: [] }, taskIndex: 0,
      directionBearing: 90, clickDirection: 180,
      hasBuildingFloors: () => false,
      stopExplorationTimer: () => {}, startExplorationTimer: () => {},
      trackerService: { setTask: () => {}, addEvent: () => {} },
      map: { getLayer: () => null, getSource: () => null, hasControl: () => false,
        setPitch: () => {}, rotateTo: () => {} },
      landmarkControl: { removeQT: () => {}, removeSearchArea: () => {} },
      _initMapFeatures: () => Promise.resolve(), zoomBounds: () => Promise.resolve(),
      changeDetectorRef: { detectChanges: () => {} }
    });
    await page.initTask();
    expect(page.directionBearing).toBe(studyBearing);
    expect(page.clickDirection).toBeNull();

    page.task.question.direction.bearing = 0;
    await page.initTask();
    expect(page.directionBearing).toBe(0);
  });
});
