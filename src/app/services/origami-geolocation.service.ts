import { Injectable } from '@angular/core';
import { Observable, BehaviorSubject, Subscriber } from 'rxjs';
import { filter, shareReplay, take } from 'rxjs/operators';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';


import { Plugins, GeolocationPosition } from '@capacitor/core';
import { Feature, MultiPolygon, Polygon } from '@turf/helpers';
import { HelperService } from './helper.service';
import { OrigamiOrientationService } from './origami-orientation.service';
import { parseVirtualWorldNumber } from '../helpers/virtual-world-numbers';

// VR world, SockitIO
import { Socket } from 'ngx-socket-io';

@Injectable({
  providedIn: 'root'
})
export class OrigamiGeolocationService {

  public geolocationSubscription: Observable<GeolocationPosition>;

  private watchID: string;

  public lastPointInBbox: BehaviorSubject<number[]> = new BehaviorSubject<number[]>(undefined);
  public lastPointInBboxDirection: BehaviorSubject<number> = new BehaviorSubject<number>(undefined);

  // VR world
  public avatarGeolocationSubscription: Observable<any>;


  constructor(private helperService: HelperService,
    private orientationService: OrigamiOrientationService,
    private socket: Socket) {}

  init(isVirtualWorld: boolean) {
    if (!isVirtualWorld) {
      this.geolocationSubscription = Observable.create((observer: Subscriber<GeolocationPosition>) => {
        this.watchID = Plugins.Geolocation.watchPosition({ enableHighAccuracy: true }, (position, error) => {
          if (error != null) {
            observer.error(error);
          }
          observer.next(position);
        });
      }).pipe(shareReplay());
    } else {
      // VR world
      this.avatarGeolocationSubscription = Observable.create((observer: Subscriber<any>) => {
        this.socket.on('updateAvatarPosition', (data) => {
          const x = parseVirtualWorldNumber(data?.x);
          const z = parseVirtualWorldNumber(data?.z);
          if (x === null || z === null) {
            return;
          }
          const position = { ...data, x, z };
          // Initial-position messages from older builds do not include height.
          if (data.y != null) {
            const y = parseVirtualWorldNumber(data.y);
            if (y === null) {
              return;
            }
            position.y = y;
          }
          observer.next(position);
        });
      }).pipe(shareReplay());
    }
  }

  getSinglePositionWatch(): Observable<GeolocationPosition> {
    return new Observable((observer: Subscriber<GeolocationPosition>) => {
      const singleWatchID = Plugins.Geolocation.watchPosition({ enableHighAccuracy: true }, (position, error) => {
        if (error != null) {
          observer.error(error);
        }
        observer.next(position);
      });

      return () => {
        Plugins.Geolocation.clearWatch({ id: singleWatchID });
      };
    });
  }

  initGeofence(bbox: Feature<Polygon, MultiPolygon>) {
    return new Observable<boolean>((subscriber) => {
      let headingSubscription;
      if(this.geolocationSubscription){
        this.geolocationSubscription.pipe(filter(p => p.coords.accuracy <= 5)).subscribe((position) => {
          // this.geolocationSubscription.subscribe((position) => {
          const point = [position.coords.longitude, position.coords.latitude];
          const inside = booleanPointInPolygon(point, bbox);
          if (inside) {
            this.lastPointInBbox.next(point);
          } else {
            if (this.lastPointInBbox.getValue() !== undefined) {
              // reset the subscription each time we get a new position
              if (headingSubscription) {
                headingSubscription.unsubscribe();
              }
              const direction = this.helperService.bearing(
                point[1],
                point[0],
                this.lastPointInBbox.getValue()[1],
                this.lastPointInBbox.getValue()[0],
              );
              headingSubscription = this.orientationService.orientationSubscription.subscribe(compassHeading => {
                const arrowDirection = 360 - (compassHeading - direction);
                this.lastPointInBboxDirection.next(arrowDirection);
              });
            } else {
              this.lastPointInBboxDirection.next(undefined);
            }
          }
          subscriber.next(inside);
        });
      }
    });
  }

  clear() {
    Plugins.Geolocation.clearWatch({ id: this.watchID });
  }
}
