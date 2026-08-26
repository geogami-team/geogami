import { Injectable, NgZone } from '@angular/core';
import { AlertController, Platform } from '@ionic/angular';
import { Observable, ReplaySubject, Subscriber, Subscription } from 'rxjs';
import { shareReplay } from 'rxjs/operators';
import { TranslateService } from '@ngx-translate/core';
import {
  DeviceOrientation,
  DeviceOrientationCompassHeading
} from '@ionic-native/device-orientation/ngx';

// VR world, SockitIO
import { Socket } from 'ngx-socket-io';

@Injectable({
  providedIn: 'root'
})
export class OrigamiOrientationService {

  /* ReplaySubject (not a cold Observable): headings arrive from the sensor as soon as
     init() runs, but the game page only subscribes once the map has loaded. With a cold
     Observable the subscriber did not exist yet and next() threw, which tore down the
     native watchHeading subscription for good (RxJS unsubscribes on a throwing handler). */
  private orientationSubject = new ReplaySubject<number>(1);
  public orientationSubscription: Observable<number> = this.orientationSubject.asObservable();

  deviceOrientationSubscription: Subscription;

  // VR world
  public avatarOrientationSubscription: Observable<any>;
  isVirtualWorld: boolean = false;

  private isListening = false;

  /* The sensor fires far faster than the arrow needs to move (the native watch polls at
     100 Hz), and every emission runs change detection over the whole map page. Coalesce
     to ~20 Hz: smooth enough for a compass, cheap enough not to stall the game. */
  private static readonly EMIT_INTERVAL = 50;
  private latestHeading: number = null;
  private emitTimer: any = null;

  constructor(
    private platform: Platform,
    private deviceOrientation: DeviceOrientation,
    private socket: Socket,
    private alertController: AlertController,
    private translate: TranslateService,
    private ngZone: NgZone
  ) { }

  async init(isVirtualWorld: boolean) {
    this.isVirtualWorld = isVirtualWorld;

    if (isVirtualWorld) {
      // VR world
      this.avatarOrientationSubscription = Observable.create((observer: Subscriber<any>) => {
        this.socket.on('updateAvatarDirection', (avatarHeading) => {
          observer.next(avatarHeading["angleValue"]);
        });
      }).pipe(shareReplay());
      return;
    }

    // a previous game may have left the subject completed/stale
    if (this.orientationSubject.closed || this.orientationSubject.isStopped) {
      this.orientationSubject = new ReplaySubject<number>(1);
      this.orientationSubscription = this.orientationSubject.asObservable();
    }

    if (this.platform.is('capacitor') && !this.platform.is('mobileweb')) {
      // native — the watch survives clear() (see below), so never start a second one
      if (this.deviceOrientationSubscription) {
        return;
      }
      this.deviceOrientationSubscription = this.deviceOrientation
        .watchHeading(this.watchOptions())
        .subscribe(
          (data: DeviceOrientationCompassHeading) => {
            this.pushHeading(data.magneticHeading);
          },
          // a failure here used to be swallowed, leaving a silently frozen arrow
          (err) => console.error('[compass] watchHeading failed', err)
        );
    } else {
      await this.listenToWebOrientation();
    }
  }

  /* iOS and Android need different watch modes, and picking the wrong one is why the
     arrow froze on iPad:

     'filter' takes CDVCompass' watchHeadingFilter path, where CoreLocation pushes every
     heading change through a kept-alive callback. 'frequency' instead makes compass.js
     poll getCurrentHeading on a JS timer, and CDVCompass.m:227 then arms a 10-second
     bTimeout that calls stopHeading — one stalled poll and the sensor shuts down for
     good. Android has no filter/keep-callback path at all (CompassListener.java answers
     one getHeading per call), so it has to keep polling. */
  private watchOptions() {
    if (this.platform.is('ios')) {
      return { filter: 1 };   // degrees of change before CoreLocation reports again
    }
    return {
      frequency: 10           //* setting it to one second will affect the compass functionality
    };
  }

  /* iOS 13+ (iPhone/iPad in the browser) fires no orientation events at all until
     DeviceOrientationEvent.requestPermission() has been granted, and that call is only
     accepted from a user gesture — hence the alert, same pattern as the 3D tilt sensor. */
  private async listenToWebOrientation() {
    if (this.isListening) {
      return;
    }

    const needsPermission =
      typeof (DeviceOrientationEvent as any) !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function';

    if (needsPermission) {
      const alert = await this.alertController.create({
        header: this.translate.instant('PlayGame.compassPermissionHeader'),
        message: this.translate.instant('PlayGame.compassPermissionMessage'),
        backdropDismiss: false,
        buttons: [
          {
            text: this.translate.instant('General.OK'),
            handler: () => {
              (DeviceOrientationEvent as any)
                .requestPermission()
                .then((permissionState) => {
                  if (permissionState === 'granted') {
                    this.addOrientationListener();
                  }
                })
                .catch(console.error);
            },
          },
        ],
      });
      await alert.present();
    } else {
      this.addOrientationListener();
    }
  }

  private addOrientationListener() {
    if (this.isListening) {
      return;
    }
    // 'deviceorientationabsolute' is north-referenced (Android Chrome); iOS does not
    // support it and delivers north via webkitCompassHeading on 'deviceorientation'.
    window.addEventListener('deviceorientationabsolute', this.handleDeviceOrientation, true);
    window.addEventListener('deviceorientation', this.handleDeviceOrientation, true);
    this.isListening = true;
  }

  handleDeviceOrientation = (event: DeviceOrientationEvent) => {
    const heading = this.toCompassHeading(event);
    if (heading != null) {
      this.pushHeading(heading);
    }
  }

  /* Both sensor sources deliver readings outside the Angular zone — the Cordova plugin
     answers through the native bridge, and the web listener is attached from a promise
     callback — so the arrow's [ngStyle] binding never re-rendered even though
     targetHeading kept changing. Re-enter the zone here, at the throttled rate. */
  private pushHeading(heading: number) {
    this.latestHeading = heading;

    // the native watch outlives clear(), so stop scheduling once the game is over
    if (this.emitTimer !== null || this.orientationSubject.isStopped) {
      return;
    }

    this.ngZone.runOutsideAngular(() => {
      this.emitTimer = setTimeout(() => {
        this.emitTimer = null;
        const value = this.latestHeading;
        this.ngZone.run(() => this.orientationSubject.next(value));
      }, OrigamiOrientationService.EMIT_INTERVAL);
    });
  }

  /* Returns degrees clockwise from magnetic/true north, in screen coordinates, or null
     when the event carries no north reference (no magnetometer, or iOS' relative alpha). */
  private toCompassHeading(event: DeviceOrientationEvent): number | null {
    const webkitHeading = (event as any).webkitCompassHeading;
    if (typeof webkitHeading === 'number' && !isNaN(webkitHeading)) {
      // iOS: already north-referenced and compensated for the interface orientation
      return this.normalize(webkitHeading);
    }

    if (event.alpha == null || event.absolute !== true) {
      // relative alpha would make the arrow point at an arbitrary direction
      return null;
    }

    // alpha counts counter-clockwise from north around the device's own z-axis, so it has
    // to be flipped and rotated by the screen angle (iPad in landscape would be 90° off).
    return this.normalize(360 - event.alpha + this.screenAngle());
  }

  private screenAngle(): number {
    const orientation = window.screen && (window.screen.orientation || (window.screen as any).msOrientation);
    if (orientation && typeof orientation.angle === 'number') {
      return orientation.angle;
    }
    return typeof (window as any).orientation === 'number' ? (window as any).orientation : 0;
  }

  private normalize(degrees: number): number {
    return ((degrees % 360) + 360) % 360;
  }

  clear() {
    if (this.emitTimer !== null) {
      clearTimeout(this.emitTimer);
      this.emitTimer = null;
    }

    if (this.isListening) {
      window.removeEventListener('deviceorientationabsolute', this.handleDeviceOrientation, true);
      window.removeEventListener('deviceorientation', this.handleDeviceOrientation, true);
      this.isListening = false;
    }

    // The native watch is deliberately left running: unsubscribing it does not stop the
    // plugin. Issue still open: https://github.com/danielsogl/awesome-cordova-plugins/issues/3537

    if (!this.isVirtualWorld) {
      this.orientationSubject.complete();
    }
  }
}
