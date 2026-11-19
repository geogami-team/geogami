import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { IonicModule, NavController } from '@ionic/angular';
import { of } from 'rxjs';

import { HOST_INFO_REQUEST } from 'src/app/models/play-session';
import { LanguageService } from 'src/app/services/language.service';
import { PlaySessionService } from 'src/app/services/play-session.service';
import { PlayingVirenvPage } from './playing-virenv.page';

describe('PlayingVirenvPage', () => {
  let component: PlayingVirenvPage;
  let fixture: ComponentFixture<PlayingVirenvPage>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ PlayingVirenvPage ],
      imports: [IonicModule.forRoot()],
      providers: [
        { provide: LanguageService, useValue: { selected: 'de' } },
        {
          provide: ActivatedRoute,
          useValue: { params: of({ queryParams: JSON.stringify({ id: 'game-1', isVRWorld: true }) }) },
        },
        { provide: NavController, useValue: jasmine.createSpyObj('NavController', ['navigateBack', 'navigateRoot']) },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(PlayingVirenvPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('tells the game page in the VE frame the selected language', () => {
    const answerHost = spyOn(TestBed.inject(PlaySessionService), 'answerHost');
    spyOn<any>(component, 'isFromVEFrame').and.returnValue(true);
    const event = { data: { type: HOST_INFO_REQUEST }, source: {} } as any;

    component.onFrameMessage(event);

    expect(answerHost).toHaveBeenCalledWith(event, 'de');
  });

  describe('keyboard focus', () => {
    // The 3D view only receives keys while its iframe has focus, and after the navigation
    // to this page focus is still in the app's own document.
    it('moves to the 3D view frame once it has loaded, so the avatar keys work without a click', () => {
      const frame: HTMLIFrameElement = fixture.nativeElement.querySelector('iframe');
      expect(frame).toBeTruthy();
      expect(document.activeElement).not.toBe(frame);

      frame.dispatchEvent(new Event('load'));

      expect(document.activeElement).toBe(frame);
    });

    it('does nothing when the frame is not there', () => {
      component.veFrame = undefined;
      expect(() => component.focusFrame()).not.toThrow();
    });
  });
});
