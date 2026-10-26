import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { IonicModule, NavController } from '@ionic/angular';
import { of } from 'rxjs';

import { PlayingVirenvPage } from './playing-virenv.page';

describe('PlayingVirenvPage', () => {
  let component: PlayingVirenvPage;
  let fixture: ComponentFixture<PlayingVirenvPage>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ PlayingVirenvPage ],
      imports: [IonicModule.forRoot()],
      providers: [
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
