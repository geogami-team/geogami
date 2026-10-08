import { CreateInfoModalComponent } from './create-info-modal.component';
import { cloneDeep } from 'lodash';

describe('CreateInfoModalComponent', () => {
  let component: CreateInfoModalComponent;
  let modalController: any;

  beforeEach(() => {
    modalController = { dismiss: jasmine.createSpy('dismiss') };
    component = new CreateInfoModalComponent(
      modalController, null, null,
      { checkVEBuilding: () => false } as any, null
    );
    component.isVirtualWorld = true;
    component.virEnvType = 'VirEnv_25';
  });

  it('keeps zero avatar speed when an info task is saved and reopened', () => {
    component.ngOnInit();
    component.task.question.text = 'Read these instructions.';
    component.task.settings.avatarSpeed = 0;
    component.dismissModal();

    const savedTask = modalController.dismiss.calls.mostRecent().args[0].data;
    expect(savedTask.settings.avatarSpeed).toBe(0);
    component.task = cloneDeep(savedTask);
    component.ngOnInit();
    expect(component.task.settings.avatarSpeed).toBe(0);
  });

  it('uses the default avatar speed for new info tasks', () => {
    component.ngOnInit();
    expect(component.task.settings.avatarSpeed).toBe(5);
  });

  it('uses the default for older tasks with no avatar speed', () => {
    component.ngOnInit();
    [undefined, null].forEach(speed => {
      component.task.settings.avatarSpeed = speed;
      component.ngOnInit();
      expect(component.task.settings.avatarSpeed).toBe(5);
    });
  });

  it('keeps a nonzero avatar speed when reopening an info task', () => {
    component.ngOnInit();
    component.task.settings.avatarSpeed = 2;
    component.ngOnInit();
    expect(component.task.settings.avatarSpeed).toBe(2);
  });
});
