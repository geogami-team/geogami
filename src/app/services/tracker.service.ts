import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Plugins, DeviceInfo, GeolocationPosition } from "@capacitor/core";

import { environment } from "../../environments/environment";
import { OrigamiGeolocationService } from "./origami-geolocation.service";
import { Subscription } from "rxjs";

import { FilesystemDirectory, FilesystemEncoding } from "@capacitor/core";
import { OrigamiOrientationService } from "./origami-orientation.service";

// VR world
import { AvatarPosition } from "src/app/models/avatarPosition";
import { Coords } from "src/app/models/coords";

@Injectable({
  providedIn: "root",
})
export class TrackerService {
  private game: string;
  private gameName: string;
  // Phase 3: instructor id for single-player class plays (null otherwise).
  private instructor: string;
  private device: DeviceInfo;
  private waypoints: any[];
  private events: any[];

  private start: String;

  private players: string[];

  private position: GeolocationPosition;
  private positionWatch: Subscription;
  private deviceOrientationSubscription: Subscription;
  private compassHeading: number;

  // VR World
  private avatarcoords: Coords;
  private avatarPosition: AvatarPosition;
  private avatarPositionWatch: Subscription;
  isVirtualWorld: boolean = false;
  private avatarOrientationSubscription: Subscription;
  initialAvatarLoc: any;

  // Multiplayer
  private isSingleMode: boolean = true;
  private numPlayers: number = 1;
  private playerNo: number = 2;
  private playersNames_list;
  private waypoints_list;
  private events_list;
  private deviceInfo_list;

  private map: any;

  private task: any;

  private panCounter = 0;
  private zoomCounter = 0;
  private rotationCounter = 0;
  private lastHeading: number = undefined;

  // vars to store taskNo and category
  private taskNo = 0;
  private taskCategory = "";

  constructor(
    private http: HttpClient,
    private geolocateService: OrigamiGeolocationService,
    private orientationService: OrigamiOrientationService
  ) {}

  async init(
    gameID,
    name,
    map: any,
    players: string[],
    isVirtualWorld: boolean,
    initialAvatarLoc: any,
    isSingleMode: boolean,
    numPlayers: number,
    playerNo: number,
    instructor: string = null
  ) {
    this.isVirtualWorld = isVirtualWorld;
    this.initialAvatarLoc = initialAvatarLoc;
    this.isSingleMode = isSingleMode;
    this.numPlayers = numPlayers;
    this.playerNo = playerNo;
    this.instructor = instructor;

    if (!isVirtualWorld) {
      this.positionWatch =
        this.geolocateService.geolocationSubscription.subscribe((position) => {
          this.position = position;
        });

      this.deviceOrientationSubscription =
        this.orientationService.orientationSubscription.subscribe(
          (heading: number) => {
            if (this.lastHeading === undefined) {
              this.lastHeading = heading;
            }

            let diff = Math.abs(this.lastHeading - heading);
            diff = Math.abs(((diff + 180) % 360) - 180);
            if (diff > 15) {
              this.rotationCounter += diff;
              this.lastHeading = heading;
            }

            this.compassHeading = heading;
          }
        );
    } else {
      // ** VR world ** //
      this.avatarPositionWatch =
        this.geolocateService.avatarGeolocationSubscription.subscribe(
          (avatarPosition) => {
            // Set timestamp (to do: timestamp)
            if (this.avatarPosition === undefined) {
              // Initial avatar position
              this.avatarPosition = new AvatarPosition(
                0,
                new Coords(this.initialAvatarLoc.lat, this.initialAvatarLoc.lng)
              );
            } else {
              this.avatarPosition = new AvatarPosition(
                0,
                new Coords(
                  parseFloat(avatarPosition["z"]) / 111200,
                  parseFloat(avatarPosition["x"]) / 111000
                )
              );
            }
          }
        );

      this.avatarOrientationSubscription =
        this.orientationService.avatarOrientationSubscription.subscribe(
          (avatarHeading: number) => {
            if (this.lastHeading === undefined) {
              this.lastHeading = avatarHeading;
            }

            let diff = Math.abs(this.lastHeading - avatarHeading);
            diff = Math.abs(((diff + 180) % 360) - 180);
            if (diff > 15) {
              this.rotationCounter += diff;
              this.lastHeading = avatarHeading;
            }

            this.compassHeading = avatarHeading;
          }
        );
    }
    this.map = map;
    this.map.on("moveend", (moveEvent) => {
      if (moveEvent.type == "moveend" && moveEvent.originalEvent) {
        this.panCounter++;
      }
    });

    this.map.on("zoomend", (zoomEvent) => {
      if (zoomEvent.type == "zoomend" && zoomEvent.originalEvent) {
        this.zoomCounter++;
      }
    });

    this.game = gameID;
    this.gameName = name;
    this.device = await Plugins.Device.getInfo().then((device) => device);
    this.waypoints = [];
    this.events = [];
    this.start = new Date().toISOString();
    this.players = players;
    this.task = undefined;
  }

  clear() {
    if (!this.isVirtualWorld) {
      this.positionWatch.unsubscribe();
      this.deviceOrientationSubscription.unsubscribe();
    } else {
      this.avatarPositionWatch.unsubscribe();
      this.avatarOrientationSubscription.unsubscribe();
    }
  }

  setTask(task) {
    this.task = task;
    this.panCounter = 0;
    this.zoomCounter = 0;
    this.rotationCounter = 0;
  }

  addWaypoint(waypoint) {
    if (this.waypoints != undefined) {
      this.waypoints.push({
        ...waypoint,
        timestamp: new Date().toISOString(),
        position: this.isVirtualWorld ? this.avatarPosition : this.position,
        mapViewport: {
          bounds: this.map.getBounds(),
          center: this.map.getCenter(),
          zoom: this.map.getZoom(),
          bearing: this.map.getBearing(),
          pitch: this.map.getPitch(),
        },
        compassHeading: this.compassHeading,
        interaction: {
          panCount: this.panCounter,
          zoomCount: this.zoomCounter / 2,
          rotation: this.rotationCounter,
        },
        taskNo: this.taskNo,
        taskCategory: this.taskCategory,
      });
    }
  }

  getWaypoints() {
    return this.waypoints;
  }

  setWaypoints(s_Waypoints) {
    this.waypoints = s_Waypoints;
  }

  getEvents() {
    return this.events;
  }

  setEvents(s_events) {
    this.events = s_events;
  }

  addEvent(event) {
    this.events.push({
      ...event,
      timestamp: new Date().toISOString(),
      position: this.isVirtualWorld ? this.avatarPosition : this.position,
      mapViewport: {
        bounds: this.map.getBounds(),
        center: this.map.getCenter(),
        zoom: this.map.getZoom(),
        bearing: this.map.getBearing(),
        pitch: this.map.getPitch(),
      },
      compassHeading: this.compassHeading,
      task: this.task,
      interaction: {
        panCount: this.panCounter,
        zoomCount: this.zoomCounter / 2,
        rotationCount: this.rotationCounter,
      },
    });
// console.log(this.events);
  }

  /*  */
  createHeaders() {
    let headers = new HttpHeaders();
    const token = window.localStorage.getItem("bg_accesstoken");
    if (token) {
      headers = headers.append("Authorization", "Bearer " + token);
    }
    headers = headers.append("Content-Type", "application/json");
    return headers;
  }

  async uploadTrack(
    isGameTrackStored: boolean = false,
    gameTrack_Id: string = undefined
  ) {
    /* (multiplayer) 1. create dynamic arrays based on game number of player 2,3,4 */
    this.playersNames_list = new Array(this.numPlayers);
    this.waypoints_list = new Array(this.numPlayers);
    this.events_list = new Array(this.numPlayers);
    this.deviceInfo_list = new Array(this.numPlayers);

    /* (multiplayer) 2. assign current player tracks in corresponding element */
    if (!this.isSingleMode && !isGameTrackStored) {
      this.playersNames_list[this.playerNo - 1] = this.players[0];
      this.waypoints_list[this.playerNo - 1] = this.waypoints;
      this.events_list[this.playerNo - 1] = this.events;
      this.deviceInfo_list[this.playerNo - 1] = this.getDeviceInfo(this.device);
    }

    const data = {
      /* (multiplayer) 3. send game track id and player no if track is already exitied in socket server room then update player's corresponding track data */
      _id: isGameTrackStored ? gameTrack_Id : undefined,
      playerNo: isGameTrackStored ? this.playerNo : undefined,
      game: this.game,
      // Phase 3: attribute single-player class plays to the instructor.
      instructor: this.instructor || undefined,
      name: this.gameName,
      start: this.start,
      end: new Date().toISOString(),
      device:
        this.isSingleMode || isGameTrackStored
          ? this.getDeviceInfo(this.device)
          : this.deviceInfo_list,
      waypoints:
        this.isSingleMode || isGameTrackStored
          ? this.waypoints
          : this.waypoints_list,
      events:
        this.isSingleMode || isGameTrackStored ? this.events : this.events_list,
      players:
        this.isSingleMode || isGameTrackStored
          ? this.players
          : this.playersNames_list,
      playersCount: this.isSingleMode ? 1 : this.numPlayers, // To Do: you may delete it.
      isMultiplayerGame: !this.isSingleMode ? true : undefined,
      // numPlayers: (!this.isSingleMode ? this.numPlayers : undefined),
    };

  // console.log(data);

    // Plugins.Geolocation.clearWatch({ id: this.positionWatch });
    if (!this.isVirtualWorld) {
      this.deviceOrientationSubscription.unsubscribe();
      this.positionWatch.unsubscribe();
    } else {
      this.avatarOrientationSubscription.unsubscribe();
      this.avatarPositionWatch.unsubscribe();
    }

    /* (multiplayer) 4.Store game tracks locally to view it in (analyze-game-list) */
    // 1. create directory
    try {
      const ret = await Plugins.Filesystem.mkdir({
        path: "origami/tracks",
        directory: FilesystemDirectory.Documents,
        recursive: true, // like mkdir -p
      });
      // console.log("Created dir", ret);
    } catch (e) {
      // console.log("Unable to make directory", e);
    }
    // 2. store tracks locally
    try {
      const result = await Plugins.Filesystem.writeFile({
        path: `origami/tracks/${this.gameName.replace(/ /g, "_")}-${
          this.start
        }.json`,
        data: JSON.stringify(data),
        directory: FilesystemDirectory.Documents,
        encoding: FilesystemEncoding.UTF8,
      });
      // console.log("Wrote file", result);
    } catch (e) {
      // console.error("Unable to write file", e);
    }
    /* End of store game tracks locally */

    /* (multiplayer) 5. Store tracks on server */
    return this.storeMultiplayerTracks(data, isGameTrackStored);
  }

  // update task number and cateogory
  updateTaskNo(taskNo, taskCategory) {
    this.taskNo = taskNo;
    this.taskCategory = taskCategory;
  }

  /* return device info */
  getDeviceInfo(device) {
    return {
      model: device.model,
      platform: device.platform,
      operatingSystem: device.operatingSystem,
      osVersion: device.osVersion,
      isVirtual: device.isVirtual,
      appName: device.appName,
      appVersion: device.appVersion,
      appBuild: device.appBuild,
      appId: device.appId,
      device_name: device.name,
      device_manufacturer: device.manufacturer,
    };
  }

  /**********************************/
  /* Store/update multiplayer tracks */
  /* multiplayer */
  /**********************************/
  storeMultiplayerTracks(data: any, isGameTrackStored: boolean) {
    if (!isGameTrackStored) {
      /* (multiplayer) 5. a) store new track if not stored yet (multiplayer) */
      // (single player) store new track
      // console.log("store new track (single player) / tracks (multiplayer)");
      return this.http
        .post(`${environment.apiURL}/track`, data, {
          headers: this.createHeaders(),
          observe: "response",
        })
        .toPromise();
    } else {
      /* (multiplayer) 5. b) update existed tracks (multiplayer) */
    // console.log("//update existed tracks (multiplayer)");
      return this.http
        .put(`${environment.apiURL}/track`, data, {
          headers: this.createHeaders(),
          observe: "response",
        })
        .toPromise();
    }
  }
  /* */

  /**********************************************************/
  //* To retreive selected game tracks - used in evaluate page
  getGameTracks(gameId: string) {
    return this.http
      .get(`${environment.apiURL}/track/gametracks/${gameId}`, {
        headers: this.createHeaders(),
      })
      .toPromise();
  }

  /**********************************************************/
  //* To retreive selected track by id - used in evaluate page
  getGameTrackById(trackId: string) {
    // console.log("🚀 ~ file: tracker.service.ts:421 ~ TrackerService ~ getGameTrackById ~ gameId:", trackId)
    return this.http
      .get(`${environment.apiURL}/track/${trackId}`, {
        headers: this.createHeaders(),
      })
      .toPromise();
  }
}
