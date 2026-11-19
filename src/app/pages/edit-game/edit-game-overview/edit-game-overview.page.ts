import {
  Component,
  ViewChild,
  AfterViewInit,
  OnDestroy,
  ChangeDetectorRef,
} from "@angular/core";

import { PopoverController } from "@ionic/angular";

import { NavController } from "@ionic/angular";

import { Game } from "../../../models/game";

import { GameFactoryService } from "../../../services/game-factory.service";

import { PopoverComponent } from "../../../popover/popover.component";
import { GamesService } from "src/app/services/games.service";

import { AnimationOptions } from "ngx-lottie";

import mapboxgl from "mapbox-gl";
import MapboxDraw from "@mapbox/mapbox-gl-draw";

import { environment } from "src/environments/environment";
import { calcBounds } from "../../../helpers/bounds";
import { AnswerType, QuestionType } from "src/app/models/types";
import { LandmarkControl } from "src/app/mapControllers/landmark-control";
import { featureCollection } from "@turf/helpers";
import { ActivatedRoute } from "@angular/router";
import { TranslateService } from "@ngx-translate/core";
// For getting user role
import { AuthService } from "../../../services/auth-service.service";
import { UtilService } from "src/app/services/util.service";
import { Subscription } from "rxjs";
import { EditorVisibilityService } from "src/app/services/editor-visibility.service";
import { detectGameAdvancedUsage } from "src/app/helpers/editor-advanced-usage";

@Component({
  selector: "app-edit-game-overview",
  templateUrl: "./edit-game-overview.page.html",
  styleUrls: ["./edit-game-overview.page.scss"],
})
export class EditGameOverviewPage implements AfterViewInit, OnDestroy {
  @ViewChild("boundingMap") mapContainer;

  public game: Game;
  public lottieConfig: AnimationOptions;
  showSuccess = false;
  showUpload = false;
  map: mapboxgl.Map;
  draw: MapboxDraw;

  // True once the boundary map has loaded the stored boundary into the drawing
  // widget (which exists from construction but starts empty). Until then saving
  // must not read it (see currentBoundary()).
  private boundaryReady = false;
  private boundaryShown = false;
  private visibilitySubscription: Subscription;

  mapSection = false;
  mapSectionVisible = true;
  landmarkControl: LandmarkControl;

  geofence = false;

  // VR world
  isVirtualWorld: boolean = false;
  isVRMirrored: boolean = false;

  disableShareData: boolean = false;      // players must consent to data sharing to play
  skipTaskPin: string = "";      // to store skip task pin

  userRole: String = "";
  user = this.authService.getUser();


  constructor(
    public popoverController: PopoverController,
    public navCtrl: NavController,
    public gameFactory: GameFactoryService,
    public gamesService: GamesService,
    private changeDetectorRef: ChangeDetectorRef,
    private route: ActivatedRoute,
    private translate: TranslateService,
    private authService: AuthService,
    private utilService: UtilService,
    public ev: EditorVisibilityService
  ) {
    this.lottieConfig = {
      path: "assets/lottie/astronaut.json",
      renderer: "svg",
      autoplay: true,
      loop: true,
    };

    this.draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: {
        polygon: true,
        trash: true,
      },
      styles: [
        // ACTIVE (being drawn)
        // line stroke
        {
          id: "gl-draw-line",
          type: "line",
          filter: [
            "all",
            ["==", "$type", "LineString"],
            ["!=", "mode", "static"],
          ],
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": getComputedStyle(
              document.documentElement
            ).getPropertyValue("--ion-color-warning"),
            "line-dasharray": [3, 2],
            "line-width": 5,
          },
        },
        // polygon fill
        {
          id: "gl-draw-polygon-fill",
          type: "fill",
          filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
          paint: {
            "fill-color": getComputedStyle(
              document.documentElement
            ).getPropertyValue("--ion-color-warning"),
            "fill-outline-color": getComputedStyle(
              document.documentElement
            ).getPropertyValue("--ion-color-warning"),
            "fill-opacity": 0.2,
          },
        },
        // polygon outline stroke
        // This doesn't style the first edge of the polygon, which uses the line stroke styling instead
        {
          id: "gl-draw-polygon-stroke-active",
          type: "line",
          filter: ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": getComputedStyle(
              document.documentElement
            ).getPropertyValue("--ion-color-warning"),
            "line-dasharray": [3, 2],
            "line-width": 5,
          },
        },
        // vertex point halos
        {
          id: "gl-draw-polygon-and-line-vertex-halo-active",
          type: "circle",
          filter: [
            "all",
            ["==", "meta", "vertex"],
            ["==", "$type", "Point"],
            ["!=", "mode", "static"],
          ],
          paint: {
            "circle-radius": 5,
            "circle-color": "#FFF",
          },
        },
        // vertex points
        {
          id: "gl-draw-polygon-and-line-vertex-active",
          type: "circle",
          filter: [
            "all",
            ["==", "meta", "vertex"],
            ["==", "$type", "Point"],
            ["!=", "mode", "static"],
          ],
          paint: {
            "circle-radius": 3,
            "circle-color": getComputedStyle(
              document.documentElement
            ).getPropertyValue("--ion-color-warning"),
          },
        },

        // INACTIVE (static, already drawn)
        // line stroke
        {
          id: "gl-draw-line-static",
          type: "line",
          filter: [
            "all",
            ["==", "$type", "LineString"],
            ["==", "mode", "static"],
          ],
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#000",
            "line-width": 3,
          },
        },
        // polygon fill
        {
          id: "gl-draw-polygon-fill-static",
          type: "fill",
          filter: ["all", ["==", "$type", "Polygon"], ["==", "mode", "static"]],
          paint: {
            "fill-color": "#000",
            "fill-outline-color": "#000",
            "fill-opacity": 0.5,
          },
        },
        // polygon outline
        {
          id: "gl-draw-polygon-stroke-static",
          type: "line",
          filter: ["all", ["==", "$type", "Polygon"], ["==", "mode", "static"]],
          layout: {
            "line-cap": "round",
            "line-join": "round",
          },
          paint: {
            "line-color": "#000",
            "line-width": 3,
          },
        },
      ],
    });
  }

  ngOnInit() {
    // Join the authoring session of the task list (or start one when this page is opened directly).
    this.ev.startSession(false);

    // The boundary map may have been created while Simple hid it; when it is shown, give it its size back.
    this.boundaryShown = this.ev.isVisible("game.boundary");
    this.visibilitySubscription = this.ev.changes$.subscribe(() => {
      const shown = this.ev.isVisible("game.boundary");
      if (shown && !this.boundaryShown && this.map) {
        setTimeout(() => this.map.resize());
      }
      this.boundaryShown = shown;
    });

    // Get user role
    this.user.subscribe((event) => {
      if (event != null) {
        this.userRole = event["roles"][0];
      }
    });
  }

  ngOnDestroy() {
    if (this.visibilitySubscription) {
      this.visibilitySubscription.unsubscribe();
    }
  }

  ngAfterViewInit(): void {
    this.route.params.subscribe((params) => {
      this.isVirtualWorld = JSON.parse(params.bundle).isVRWorld;
      this.isVRMirrored = JSON.parse(params.bundle).isVRMirrored;
      this.gamesService
        .getGame(JSON.parse(params.bundle).game_id)
        .then((res) => res.content)
        .then((game) => {
          this.game = game;
          this.gameFactory.flushGame();
          this.gameFactory.addGameInformation(this.game);

          if (this.game.bbox?.features?.length > 0) {
            this.mapSection = true;
          }

          this.mapSectionVisible = this.game.mapSectionVisible;
          this.geofence = this.game.geofence;
          this.disableShareData = this.game.disableShareData;
          this.skipTaskPin = this.game.skipTaskPin;

          if (this.mapSection) {
            this.changeDetectorRef.detectChanges();
            this.initMap();
          }
        }, () => {
          // Game was deleted or the id is unknown: say so instead of opening
          // an empty editor (same as edit-game-tasks).
          this.utilService.showToast(
            this.translate.instant("PlayGame.gameNotFound"),
            "warning",
            3000,
            "toast-black-text"
          );
          this.navCtrl.navigateForward("/");
        });
    });

    // this.gameFactory.getGame().then(game => { this.game = game }).finally(() => {
    //   this.initMap()
    // })
  }

  initMap() {
    this.boundaryReady = false;
    mapboxgl.accessToken = environment.mapboxAccessToken;

    // Set bounds of VR world
    var bounds = [
      [0.0002307207207 - 0.003, 0.0003628597122 - 0.003], // Southwest coordinates
      [0.003717027207 + 0.003, 0.004459082914 + 0.003], // Northeast coordinates
    ];

    this.map = new mapboxgl.Map({
      container: this.mapContainer.nativeElement,
      style: this.isVirtualWorld
        ? this.isVRMirrored
          ? environment.mapStyle + "virtualEnv_2.json"
          : environment.mapStyle + "virtualEnv_1.json"
        : environment.mapStyle + "realWorld.json",
      center: this.isVirtualWorld
        ? [0.00001785714286 / 2, 0.002936936937 / 2]
        : [8, 51.8],
      zoom: 2,
      maxBounds: this.isVirtualWorld ? bounds : null, // Sets bounds
    });

    this.map.addControl(this.draw, "top-left");

    this.map.on("load", () => {
      // disable map rotation in VR world
      if (this.isVirtualWorld) {
        // disable map rotation using right click + drag
        this.map.dragRotate.disable();
        // disable map rotation using touch rotation gesture
        this.map.touchZoomRotate.disableRotation();
      }

      if (this.game.bbox != undefined) {
        if (this.game.bbox.type == "FeatureCollection") {
          this.game.bbox.features.forEach((element) => {
            element.properties = {
              ...element.properties,
            };
            this.draw.add(element);
          });
        }
      }
      this.boundaryReady = true;

      let bounds = new mapboxgl.LngLatBounds();

      this.game.tasks.forEach((task) => {
        bounds = bounds.extend(calcBounds(task));
      });

      // this.map.resize()

      if (!bounds.isEmpty()) {
        this.map.fitBounds(bounds, {
          padding: {
            top: 40,
            bottom: 40,
            left: 40,
            right: 40,
          },
          duration: 1000,
          maxZoom: 16,
        });
      }

      this.map.loadImage(
        "/assets/icons/directionv2-richtung.png",
        (error, image) => {
          if (error) throw error;

          this.map.addImage("view-direction-task", image);
        }
      );

      this.map.loadImage(
        "/assets/icons/landmark-marker.png",
        (error, image) => {
          if (error) throw error;

          this.map.addImage("landmark-marker", image);
        }
      );
      this.landmarkControl = new LandmarkControl(this.map);

      let qtlandmarks = featureCollection([]);
      let searchareas = featureCollection([]);
      let landmarks = featureCollection([]);

      for (const [i, task] of this.game.tasks.entries()) {
        if (
          task.answer.type == AnswerType.POSITION &&
          task.answer.position?.geometry?.coordinates
        ) {
          const el = document.createElement("div");
          el.className = "waypoint-marker";

          new mapboxgl.Marker(el, {
            anchor: "bottom",
            offset: [15, 0],
          })
            .setLngLat(task.answer.position.geometry.coordinates)
            .addTo(this.map);
        }

        if (
          task.question.type == QuestionType.MAP_FEATURE ||
          task.question.type == QuestionType.MAP_FEATURE_FREE ||
          task.question.type == QuestionType.MAP_FEATURE_PHOTO
        ) {
          qtlandmarks = featureCollection([
            ...qtlandmarks.features,
            ...task.question.geometry.features,
          ]);
        }

        if (task.question.area?.features?.length > 0) {
          searchareas = featureCollection([
            ...searchareas.features,
            ...task.question.area.features,
          ]);
        }

        if (task.mapFeatures.landmarks) {
          landmarks = featureCollection([
            ...landmarks.features,
            ...task.mapFeatures.landmarkFeatures.features,
          ]);
        }

        if (
          task.question.type == QuestionType.MAP_DIRECTION_MARKER ||
          task.question.type == QuestionType.MAP_DIRECTION
        ) {
          const directionBearing = task.question.direction.bearing || 0;

          this.map.addSource(`viewDirectionTask${i}`, {
            type: "geojson",
            data: task.question.direction.position.geometry,
          });
          this.map.addLayer({
            id: `viewDirectionTask${i}`,
            source: `viewDirectionTask${i}`,
            type: "symbol",
            layout: {
              "icon-image": "view-direction-task",
              "icon-size": 0.65,
              "icon-offset": [0, -8],
              "icon-rotate": directionBearing - this.map.getBearing(),
            },
          });
        }
      }
      this.landmarkControl.setQTLandmark(qtlandmarks);
      this.landmarkControl.setSearchArea(searchareas);
      this.landmarkControl.setLandmark(landmarks);
    });
  }

  mapSectionToggleChange(event) {
    if (this.mapSection) {
      this.changeDetectorRef.detectChanges();

      this.initMap();
    } else {
      this.geofence = false;
    }
  }

  mapSectionVisibleChange(visible: boolean) {
    if (this.mapSectionVisible != visible) {
      this.draw.deleteAll();
      this.mapSectionVisible = visible;
    }
  }

  async showTrackingInfo(ev: any, text: string) {
  // console.log(ev);
    const popover = await this.popoverController.create({
      component: PopoverComponent,
      event: ev,
      translucent: true,
      componentProps: { text },
    });
    return await popover.present();
  }

  uploadGame() {
    // if device is not connected to internet, show notification
    if (!this.utilService.getIsOnlineValue()) {
      // show no connection notification
      this.utilService.showAlertNoConnection();
      return;
    }

    // Remove extra spaces from game name
    this.game.name = this.game.name.trim();

    if (this.game.name == "") {
      this.utilService.showValidationError(
        this.translate.instant("SaveGame.enterValidGameName")
      );
      return;
    }

    this.gameFactory.addGameInformation({
      bbox: this.mapSection ? this.currentBoundary() : null,
      mapSectionVisible: this.mapSectionVisible,
      geofence: this.geofence,
      name: this.game.name,
      place: this.game.place,
      disableShareData: this.disableShareData, // players must consent to data sharing to play
      skipTaskPin: this.skipTaskPin, // to store skip task pin
      tasksCount: this.game.tasks.length, //* it might happen that user add or remove tasks, so we need to update the tasks
    });
  // console.log(this.gameFactory.game);

    this.showUpload = true;

    this.gamesService
      .updateGame(this.gameFactory.game)
      .then((res) => {
        if (res.status == 200) {
          this.showSuccess = true;
          this.gameFactory.flushGame();
        }
      })
      .catch((e) => {
        console.error(e);
        this.showUpload = false;
        this.utilService.showValidationError(
          this.translate.instant("SaveGame.gameNameExist")
        );
      });

    // this.gamesService
    //   .postGame(this.gameFactory.game)
    //   .then(res => {
    //     if (res.status == 200) {
    //       this.showSuccess = true;
    //       this.gameFactory.flushGame();
    //     }
    //   })
    //   .catch(e => console.error(e));
  }

  // The boundary to save. The drawing widget is the source of truth once it has
  // loaded the stored boundary; before that (its map is still loading, or was
  // created while Simple hid it) it is empty, and saving must not replace the
  // stored boundary with that emptiness.
  private currentBoundary() {
    if (this.boundaryReady) {
      return this.draw.getAll();
    }
    return this.game.bbox || { type: "FeatureCollection", features: [] };
  }

  // Settings of this game that only Advanced shows (for the "uses advanced
  // settings" notice). The list object is reused while its content is unchanged.
  private lastAdvancedInUse: string[] = [];
  get advancedInUse(): string[] {
    if (this.ev.mode === "advanced") {
      return [];
    }
    const next = detectGameAdvancedUsage(
      { hasBoundary: this.mapSection, disableShareData: this.disableShareData },
      (featureId) => this.ev.isHiddenInSimple(featureId)
    );
    if (next.join("|") !== this.lastAdvancedInUse.join("|")) {
      this.lastAdvancedInUse = next;
    }
    return this.lastAdvancedInUse;
  }

  navigateHome() {
    this.navCtrl.navigateRoot("/");
  }

  async showPopover(ev: any, key: string) {
    let text = this.translate.instant(key);

  // console.log(ev);
    const popover = await this.popoverController.create({
      component: PopoverComponent,
      event: ev,
      translucent: true,
      componentProps: { text },
    });
    return await popover.present();
  }
}
