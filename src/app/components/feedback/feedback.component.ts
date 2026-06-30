import { Map as MapboxMap } from "mapbox-gl";
import { OrigamiGeolocationService } from "../../services/origami-geolocation.service";
import { Subscription } from "rxjs";
import { Task } from "../../models/task";
import { AnswerType, QuestionType, TaskMode } from "../../models/types";
import { HelperService } from "../../services/helper.service";
import { PlayingGamePage } from "../../pages/play-game/playing-game/playing-game.page";
import { ToastController } from "@ionic/angular";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { TrackerService } from "../../services/tracker.service";
import { ChangeDetectorRef, Component } from "@angular/core";
import { Plugins, Capacitor, GeolocationPosition } from "@capacitor/core";
import centroid from "@turf/centroid";
import { OrigamiOrientationService } from "src/app/services/origami-orientation.service";
import { DomSanitizer } from "@angular/platform-browser";
import mapboxgl from "mapbox-gl";
import bbox from "@turf/bbox";

// VR world
import { AvatarPosition } from "src/app/models/avatarPosition";
import { Coords } from "src/app/models/coords";
import { TranslateService } from "@ngx-translate/core";
import { VEBuildingUtilService } from "src/app/services/ve-building-util.service";

enum FeedbackType {
  Correct,
  Wrong,
  TryAgain,
  Saved,
  Success,
}

@Component({
  selector: "app-feedback",
  templateUrl: "./feedback.component.html",
  styleUrls: ["./feedback.component.scss"],
  inputs: [],
})
export class FeedbackComponent {
  private positionSubscription: Subscription;
  private task: Task;
  private lastKnownPosition: GeolocationPosition;
  private Math: Math = Math;
  private audioPlayer: HTMLAudioElement = new Audio();

  // VR world
  private avatarPositionSubscription: Subscription;
  private avatarOrientationSubscription: Subscription;
  avatarLastKnownPosition: AvatarPosition;
  private waypoint: any;
  isVirtualWorld: boolean = false;

  showFeedback = false;
  private feedback: any = {
    text: "",
    icon: "",
    solution: "",
    img: "",
    hint: "",
  };
  private feedbackRetry = false;

  private map: any;
  private geolocationService: OrigamiGeolocationService;
  private helperService: HelperService;
  private toastController: ToastController;
  private trackerService: TrackerService;
  private playingGamePage: PlayingGamePage;

  private feedbackDuration = 4000;
  deviceOrientationSubscription: any;
  private direction: number;
  successColor: string;

  private DIRECTION_TRESHOLD = 30;

  constructor(
    private orientationService: OrigamiOrientationService,
    private changeDetectorRef: ChangeDetectorRef,
    private sanitizer: DomSanitizer,
    private translate: TranslateService,
    private veBuildingUtilService: VEBuildingUtilService
  ) {}

  init(
    map: any,
    geolocationService: OrigamiGeolocationService,
    helperService: HelperService,
    toastController: ToastController,
    trackerService: TrackerService,
    playingGamePage: PlayingGamePage
  ) {
    this.map = map;
    this.geolocationService = geolocationService;
    this.helperService = helperService;
    this.toastController = toastController;
    this.trackerService = trackerService;
    this.playingGamePage = playingGamePage;

    this.successColor = getComputedStyle(
      document.documentElement
    ).getPropertyValue("--ion-color-success");

    this.map.loadImage(
      "/assets/icons/marker-editor-solution.png",
      (error, image) => {
        if (error) throw error;

        this.map.addImage("geolocate-solution", image);
      }
    );

    this.map.loadImage(
      "/assets/icons/directionv2-solution.png",
      (error, image) => {
        if (error) throw error;

        this.map.addImage("direction-solution", image);
      }
    );

    this.map.loadImage("/assets/icons/directionv2.png", (error, image) => {
      if (error) throw error;

      this.map.addImage("directionv2", image);
    });

    this.audioPlayer.src =
      "assets/sounds/zapsplat_multimedia_alert_musical_warm_arp_005_46194.mp3";

    // VR world (to check type of the game)
    this.isVirtualWorld = playingGamePage.isVirtualWorld;

    if (!this.isVirtualWorld) {
      this.positionSubscription =
        this.geolocationService.geolocationSubscription.subscribe(
          (position: GeolocationPosition) => {
            this.lastKnownPosition = position;

            if (this.task && !PlayingGamePage.showSuccess) {
              if (this.task.answer.type == AnswerType.POSITION) {
                const waypoint = this.task.answer.position.geometry.coordinates;

                if (
                  this.userDidArrive(waypoint) &&
                  !this.task.settings.confirmation &&
                  !this.showFeedback
                ) {
                  this.onWaypointReached();
                }
              }
            }
          }
        );

      this.deviceOrientationSubscription =
        this.orientationService.orientationSubscription.subscribe(
          (heading: number) => {
            this.direction = heading;
          }
        );
    } else {
      // VR world
      this.avatarPositionSubscription =
        this.geolocationService.avatarGeolocationSubscription.subscribe(
          (avatarPosition) => {
            if (this.avatarLastKnownPosition === undefined) {
              // Initial avatar's positoin to measure target distance that will be displayed in VR app
              this.avatarLastKnownPosition = new AvatarPosition(
                0,
                new Coords(
                  this.playingGamePage.initialAvatarLoc.lat,
                  this.playingGamePage.initialAvatarLoc.lng
                )
              );
            } else if (!Number.isNaN(parseFloat(avatarPosition["z"]))) {
              this.avatarLastKnownPosition = new AvatarPosition(
                0,
                new Coords(
                  parseFloat(avatarPosition["z"]) / 111200,
                  parseFloat(avatarPosition["x"]) / 111000
                )
              );
            }

            if (this.task && !PlayingGamePage.showSuccess) {
              if (this.task.answer.type == AnswerType.POSITION) {
                this.waypoint = this.task.answer.position.geometry.coordinates;

                if (
                  this.userDidArrive(this.waypoint) &&
                  !this.task.settings.confirmation &&
                  !this.showFeedback
                ) {
                  this.onWaypointReached();
                }
              }
            }
          }
        );

      // Avatar's direction
      this.avatarOrientationSubscription =
        this.orientationService.avatarOrientationSubscription.subscribe(
          (avatarHeading) => {
            this.direction = avatarHeading;
          }
        );
    }
  }

  public setTask(task: Task) {
    this.dismissFeedback();
    this.task = task;
  }

  public async setAnswer({
    selectedPhoto,
    isCorrectPhotoSelected,
    selectedChoice,
    isCorrectChoiceSelected,
    photo,
    photoURL,
    directionBearing,
    compassHeading,
    clickDirection,
    numberInput,
    textInput,
    draw,
  }) {
    let isCorrect = true;
    let answer: any = {};

    console.log("setAnswer-----11111");
    if (this.task.answer.type == AnswerType.POSITION) {
      console.log("setAnswer-----iffffff-0");
      const waypoint = this.task.answer.position.geometry.coordinates;
      const arrived = this.userDidArrive(waypoint);
      console.log("setAnswer-----iffffff-1");
      answer = {
        target: waypoint,
        position: this.isVirtualWorld
          ? this.avatarLastKnownPosition
          : this.lastKnownPosition,
        distance: this.helperService.getDistanceFromLatLonInM(
          waypoint[1],
          waypoint[0],
          this.isVirtualWorld
            ? this.avatarLastKnownPosition.coords.latitude
            : this.lastKnownPosition.coords.latitude,
          this.isVirtualWorld
            ? this.avatarLastKnownPosition.coords.longitude
            : this.lastKnownPosition.coords.longitude
        ),
        correct: arrived,
      };
      console.log("setAnswer-----iffffff-2");
      isCorrect = arrived;
      console.log("setAnswer-----iffffff-3");
      if (!arrived) {
        console.log("setAnswer-----iffffff-4");
        this.initFeedback(false);
      } else {
        console.log("setAnswer-----iffffff-5");
        this.onWaypointReached();
      }
    }

    console.log("setAnswer-----22222");

    if (this.task.type == "theme-loc") {
      if (this.map.getSource("marker-point")) {
        const clickPosition =
          this.map.getSource("marker-point")._data.geometry.coordinates;
        const distance = this.helperService.getDistanceFromLatLonInM(
          clickPosition[1],
          clickPosition[0],
          this.isVirtualWorld
            ? this.avatarLastKnownPosition.coords.latitude
            : this.lastKnownPosition.coords.latitude,
          this.isVirtualWorld
            ? this.avatarLastKnownPosition.coords.longitude
            : this.lastKnownPosition.coords.longitude
        );
        isCorrect = distance < PlayingGamePage.triggerTreshold;
        answer = {
          clickPosition,
          distance,
          correct: isCorrect,
        };

        this.initFeedback(distance < PlayingGamePage.triggerTreshold, {
          distance,
          clickPosition,
        });
      } else {
        const toast = await this.toastController.create({
          message: this.translate.instant("Feedback.setPosition"),
          color: "dark",
          // showCloseButton: true,
          duration: 2000,
        });
        toast.present();

        isCorrect = false;
        answer = {
          clickPosition: undefined,
          distance: undefined,
          correct: isCorrect,
        };
      }
    }

    if (this.task.answer.type == AnswerType.MULTIPLE_CHOICE) {
      if (selectedPhoto != null) {
        this.initFeedback(isCorrectPhotoSelected, { selectedPhoto });
        isCorrect = isCorrectPhotoSelected;
        answer = {
          selectedPhoto,
          correct: isCorrect,
        };
        if (isCorrectPhotoSelected) {
          isCorrectPhotoSelected = null;
          selectedPhoto = null;
        }
      } else {
        const toast = await this.toastController.create({
          message: this.translate.instant("Feedback.choosePhoto"),
          color: "dark",
          // showCloseButton: true,
          duration: 2000,
        });
        toast.present();
        isCorrect = false;
        answer = {
          selectedPhoto: null,
          correct: isCorrect,
        };
      }
    }

    if (this.task.answer.type == AnswerType.MULTIPLE_CHOICE_TEXT) {
      if (selectedChoice != null) {
        this.initFeedback(isCorrectChoiceSelected, { selectedChoice });
        isCorrect = isCorrectChoiceSelected;
        answer = {
          selectedChoice,
          correct: isCorrect,
        };
        if (isCorrectChoiceSelected) {
          isCorrectChoiceSelected = null;
          selectedChoice = null;
        }
      } else {
        const toast = await this.toastController.create({
          message: this.translate.instant("Feedback.chooseAnswer"),
          color: "dark",
          // showCloseButton: true,
          duration: 2000,
        });
        toast.present();
        isCorrect = false;
        answer = {
          selectedChoice: null,
          correct: isCorrect,
        };
      }
    }

    // To store photo url: either taken or uploaded (Y.Q.)
    if (this.task.answer.type == AnswerType.PHOTO) {
      if (photo == "") {
        const toast = await this.toastController.create({
          message: this.translate.instant("Feedback.takePhoto"),
          color: "dark",
          // showCloseButton: true,
          duration: 2000,
        });
        toast.present();

        isCorrect = false;
        answer = {
          photo: null,
          correct: isCorrect,
        };
      } else {
        this.initFeedback(true);
        isCorrect = true;
        answer = {
          photo,
          correct: isCorrect,
        };
        photo = "";
        photoURL = "";
      }
    }

    if (
      this.task.answer.type == AnswerType.MAP_POINT &&
      this.task.type != "theme-loc"
    ) {
      if (this.map.getSource("marker-point")) {
        const clickPosition =
          this.map.getSource("marker-point")._data.geometry.coordinates;
        const isInPolygon = booleanPointInPolygon(
          clickPosition,
          this.task.question.geometry.features[0]
        );
        this.initFeedback(isInPolygon, { clickPosition });
        isCorrect = isInPolygon;
        answer = {
          clickPosition,
          correct: isCorrect,
        };
      } else {
        const toast = await this.toastController.create({
          message: this.translate.instant("Feedback.setPoint"),
          color: "dark",
          // showCloseButton: true,
          duration: 2000,
        });
        toast.present();
        isCorrect = false;
        answer = {
          clickPosition: undefined,
          correct: isCorrect,
        };
      }
    }

    if (this.task.answer.type == AnswerType.DIRECTION) {
      // // console.log(this.Math.abs(directionBearing - compassHeading));
      this.initFeedback(
        this.Math.abs(directionBearing - compassHeading) <=
          this.DIRECTION_TRESHOLD,
        { clickDirection }
      );
      isCorrect =
        this.Math.abs(directionBearing - compassHeading) <=
        this.DIRECTION_TRESHOLD;
      answer = {
        compassHeading,
        correct: isCorrect,
      };
    }

    if (this.task.answer.type == AnswerType.MAP_DIRECTION) {
      if (clickDirection != 0) {
        if (
          this.task.question.type == QuestionType.MAP_DIRECTION_PHOTO &&
          this.task.question.direction?.bearing != undefined
        ) {
          this.initFeedback(
            this.Math.abs(
              clickDirection - this.task.question.direction.bearing
            ) <= this.DIRECTION_TRESHOLD,
            { clickDirection }
          );
          isCorrect =
            this.Math.abs(
              clickDirection - this.task.question.direction.bearing
            ) <= this.DIRECTION_TRESHOLD;
        } else {
          this.initFeedback(
            this.Math.abs(clickDirection - compassHeading) <=
              this.DIRECTION_TRESHOLD,
            { clickDirection }
          );
          isCorrect =
            this.Math.abs(clickDirection - compassHeading) <=
            this.DIRECTION_TRESHOLD;
        }
        answer = {
          clickDirection,
          correct: isCorrect,
        };
      } else {
        const toast = await this.toastController.create({
          message: this.translate.instant("Feedback.setLineofsight"),
          color: "dark",
          // showCloseButton: true,
          duration: 2000,
        });
        toast.present();
        isCorrect = false;
        answer = {
          compassHeading: undefined,
          correct: isCorrect,
        };
      }
    }

    if (this.task.answer.type == AnswerType.NUMBER) {
      if (numberInput != undefined) {
        isCorrect = numberInput == this.task.answer.number;
        this.initFeedback(isCorrect);
        answer = {
          numberInput,
          correct: isCorrect,
        };
      } else {
        const toast = await this.toastController.create({
          message: this.translate.instant("Feedback.enterNumber"),
          color: "dark",
          // showCloseButton: true,
          duration: 2000,
        });
        toast.present();
        isCorrect = false;
        answer = {
          numberInput: undefined,
          correct: isCorrect,
        };
      }
    }

    if (this.task.answer.type == AnswerType.TEXT) {
      if (textInput != undefined) {
        this.initFeedback(true);
        isCorrect = true;
        answer = {
          text: textInput,
          correct: isCorrect,
        };
      } else {
        const toast = await this.toastController.create({
          message: this.translate.instant("Feedback.enterAnswer"),
          color: "dark",
          // showCloseButton: true,
          duration: 2000,
        });
        toast.present();
        isCorrect = false;
        answer = {
          text: undefined,
          correct: isCorrect,
        };
      }
    }

    // Free DRAW tasks: store the final drawing geometry (the MapboxDraw
    // FeatureCollection from DrawControl.getAll()) rather than relying on the
    // raw ON_MAP_CLICKED stream. The FeatureCollection already reflects any
    // edits/deletions and carries each feature's geometry.type
    // (Point / LineString / Polygon).
    if (this.task.answer.type == AnswerType.DRAW) {
      isCorrect = true;
      answer = {
        drawing: draw,
        correct: isCorrect,
      };
    }

    this.trackerService.addEvent({
      type: "ON_OK_CLICKED",
      correct: isCorrect,
      answer,
    });
  }

  public initFeedback(correct: boolean, options: any = undefined) {
    // feedback is already showing.
    if (this.showFeedback) {
      return;
    }

    let type: FeedbackType;

    if (this.task.settings.feedback) {
      if (correct) {
        type = FeedbackType.Correct;
      } else if (this.task.settings.multipleTries) {
        type = FeedbackType.TryAgain;
      } else {
        type = FeedbackType.Wrong;
      }
    } else {
      if (this.task.category == "nav" && this.task.settings.confirmation) {
        type = FeedbackType.Success;
      } else {
        type = FeedbackType.Saved;
      }
    }

    switch (type) {
      case FeedbackType.Correct:
        this.feedback.icon = "😊";
        this.feedback.text = this.translate.instant("Feedback.correct");
        break;
      case FeedbackType.Wrong:
        this.feedback.text = this.translate.instant("Feedback.wrong");

        if (
          this.task.answer.type === AnswerType.MAP_POINT &&
          this.task.type == "theme-loc"
        ) {
          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend(options.clickPosition);
          // console.log(this.lastKnownPosition.coords);

          bounds.extend([
            this.isVirtualWorld
              ? this.avatarLastKnownPosition.coords.longitude
              : this.lastKnownPosition.coords.longitude,
            this.isVirtualWorld
              ? this.avatarLastKnownPosition.coords.latitude
              : this.lastKnownPosition.coords.latitude,
          ]);

          this.map.fitBounds(bounds, {
            padding: {
              top: 80,
              bottom: 500,
              left: 40,
              right: 40,
            },
            duration: 1000,
            maxZoom: 16,
          });
        }

        if (
          this.task.answer.type === AnswerType.MULTIPLE_CHOICE ||
          this.task.answer.type === AnswerType.MULTIPLE_CHOICE_TEXT ||
          this.task.answer.type === AnswerType.NUMBER
        ) {
          this.feedback.text = "Das stimmt leider nicht.";
        }

        if (this.task.type === "nav-flag" && this.task.settings.confirmation) {
          this.feedback.text = this.sanitizer.bypassSecurityTrustHtml(
            'Das stimmt leider nicht.<br />Der <ion-text color="danger">rote Punkt</ion-text> zeigt dir, wo du bist.'
          );

          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend(this.task.answer.position.coordinates);
          bounds.extend([
            this.isVirtualWorld
              ? this.avatarLastKnownPosition.coords.longitude
              : this.lastKnownPosition.coords.longitude,
            this.isVirtualWorld
              ? this.avatarLastKnownPosition.coords.latitude
              : this.lastKnownPosition.coords.latitude,
          ]);

          this.map.fitBounds(bounds, {
            padding: {
              top: 80,
              bottom: 500,
              left: 40,
              right: 40,
            },
            duration: 1000,
            maxZoom: 16,
          });
        }

        if (
          this.task.type === "theme-object" &&
          this.task.answer.type === AnswerType.MAP_POINT &&
          this.task.answer.mode === TaskMode.NO_FEATURE
        ) {
          const bounds = new mapboxgl.LngLatBounds();
          bounds.extend(options.clickPosition);
          bounds.extend(bbox(this.task.question.geometry));

          this.map.fitBounds(bounds, {
            padding: {
              top: 80,
              bottom: 500,
              left: 40,
              right: 40,
            },
            duration: 1000,
            maxZoom: 16,
          });
        }

        if (
          this.task.question.type == QuestionType.MAP_DIRECTION_MARKER &&
          this.task.answer.type !== AnswerType.MULTIPLE_CHOICE
        ) {
          this.feedback.text = this.sanitizer.bypassSecurityTrustHtml(
            'Das stimmt leider nicht.<br />Der <ion-text color="danger">rote Pfeil</ion-text> zeigt dir, in welche Richtung du siehst.'
          );
        }
        this.feedback.icon = "😕";
        break;
      case FeedbackType.TryAgain:
        this.feedback.icon = "😕";
        this.feedback.text =
          this.task.answer?.hints == undefined
            ? this.translate.instant("Feedback.tryAgain")
            : "";
        this.feedbackRetry = true;
        break;
      case FeedbackType.Saved:
        this.feedback.icon = "";
        this.feedback.text = this.translate.instant("Feedback.saved");
        break;
      case FeedbackType.Success:
        this.feedback.icon = "";
        this.feedback.text = this.translate.instant("Feedback.success");
        break;
    }

    this.feedback.hint = "";
    this.feedback.solution = "";

    if (
      this.task.settings.feedback &&
      !this.task.settings.multipleTries &&
      !correct
    ) {
      this.showSolution();
    }

    if (
      this.task.settings.feedback &&
      this.task.settings.multipleTries &&
      type === FeedbackType.TryAgain &&
      !correct
    ) {
      this.showHint(options);
    }

    if (
      (this.task.answer.type === AnswerType.MAP_DIRECTION ||
        this.task.answer.type === AnswerType.DIRECTION) &&
      !correct
    ) {
      this.showHint(options);
    }

    this.showFeedback = true;

    if (type != FeedbackType.TryAgain) {
      if (Capacitor.isNative) {
        Plugins.Haptics.vibrate();
      }
      this.audioPlayer.play();
    }

    if (this.task.settings.multipleTries) {
      setTimeout(() => {
        this.dismissFeedback();
        if (type !== FeedbackType.TryAgain) {
          this.playingGamePage.nextTask();
        }
      }, this.feedbackDuration);
    } else if (!this.task.settings.feedback) {
      setTimeout(() => {
        this.dismissFeedback();
        this.playingGamePage.nextTask();
      }, 2000);
    }
  }

  nextTask() {
    this.dismissFeedback();
    this.playingGamePage.nextTask();
  }

  public showHint(options: any = undefined) {
    // // console.log(options);
    if (this.task.answer.type == AnswerType.POSITION) {
      const waypoint = this.task.answer.position.geometry.coordinates;
      const distance = this.helperService.getDistanceFromLatLonInM(
        waypoint[1],
        waypoint[0],
        this.isVirtualWorld
          ? this.avatarLastKnownPosition.coords.latitude
          : this.lastKnownPosition.coords.latitude,
        this.isVirtualWorld
          ? this.avatarLastKnownPosition.coords.longitude
          : this.lastKnownPosition.coords.longitude
      );
      const evalDistance =
        distance - (PlayingGamePage.triggerTreshold as number);
      if (evalDistance > 10) {
        this.feedback.hint = this.translate.instant(
          "Feedback.distanceFromDistanation1",
          { distance: `${distance.toFixed(1)}` }
        );
      } else {
        this.feedback.hint = this.translate.instant("Feedback.youAreNearGoal");
      }
    }

    if (this.task.type == "theme-loc") {
      const evalDistance =
        options.distance - (PlayingGamePage.triggerTreshold as number);
      if (evalDistance > 10) {
        this.feedback.hint = this.translate.instant(
          "Feedback.distanceFromDistanation2",
          { distance: `${options.distance.toFixed(1)}` }
        );
      } else {
        this.feedback.hint = this.translate.instant("Feedback.youAreNear");
      }
    }

    if (this.task.answer.type == AnswerType.MULTIPLE_CHOICE) {
      this.feedback.hint = this.task.answer.hints[options.selectedPhoto.key];
    }

    if (this.task.answer.type == AnswerType.MULTIPLE_CHOICE_TEXT) {
      this.feedback.hint = this.task.answer.hints[options.selectedChoice.key];
    }

    if (
      this.task.answer.type == AnswerType.MAP_POINT &&
      this.task.type != "theme-loc"
    ) {
      const center = centroid(this.task.question.geometry.features[0]);
      // // console.log(center);
      const waypoint = options.clickPosition;
      const distance = this.helperService.getDistanceFromLatLonInM(
        waypoint[1],
        waypoint[0],
        center.geometry.coordinates[1],
        center.geometry.coordinates[0]
      );
      const evalDistance =
        distance - (PlayingGamePage.triggerTreshold as number);
      if (evalDistance > 10) {
        this.feedback.hint = this.translate.instant(
          "Feedback.distanceFromDistanation2",
          { distance: `${distance.toFixed(1)}` }
        );
      } else {
        this.feedback.hint = this.translate.instant("Feedback.youAreNear");
      }
    }

    if (
      this.task.answer.type == AnswerType.MAP_DIRECTION ||
      this.task.answer.type == AnswerType.DIRECTION
    ) {
      let evalDirection = this.direction;
      if (this.task.question.direction?.bearing) {
        evalDirection = this.task.question.direction.bearing;
      }

      const absClckDir = this.Math.abs(options.clickDirection - evalDirection);
      // console.log(absClckDir);

      this.feedback.hint = "";

      if (absClckDir > 30 && absClckDir <= 45) {
        this.feedback.hint =
          this.task.answer?.hints?.[0] ??
          this.translate.instant("Feedback.directionRight");
      } else if (absClckDir > 45 && absClckDir <= 135) {
        this.feedback.hint =
          this.task.answer?.hints?.[1] ??
          this.translate.instant("Feedback.directionWrong");
      } else if (absClckDir > 135) {
        this.feedback.hint =
          this.task.answer?.hints?.[2] ??
          this.translate.instant("Feedback.directionWrongHint");
      }
      // // console.log(this.feedback.hint);
      this.changeDetectorRef.detectChanges();
    }

    if (this.task.answer.type == AnswerType.NUMBER) {
    }

    if (this.task.answer.type == AnswerType.TEXT) {
    }
  }

  public showSolution() {
    this.feedback.solution = "";
    this.feedback.img = "";

    if (this.task.answer.type == AnswerType.POSITION) {
      this.map.addSource("geolocate-solution", {
        type: "geojson",
        data: {
          type: "Point",
          coordinates: [
            this.isVirtualWorld
              ? this.avatarLastKnownPosition.coords.longitude
              : this.lastKnownPosition.coords.longitude,
            this.isVirtualWorld
              ? this.avatarLastKnownPosition.coords.latitude
              : this.lastKnownPosition.coords.latitude,
          ],
        },
      });

      const image =
        this.task.type === "nav-flag" && this.task.settings.confirmation
          ? "geolocate"
          : "geolocate-solution";

      this.map.addLayer({
        id: "geolocate-solution",
        source: "geolocate-solution",
        type: "symbol",
        layout: {
          "icon-image": image,
          "icon-size": 0.65,
          "icon-offset": [0, 0],
          "icon-allow-overlap": true,
        },
      });
    }

    if (this.task.type == "theme-loc") {
      this.map.addSource("geolocate-solution", {
        type: "geojson",
        data: {
          type: "Point",
          coordinates: [
            this.isVirtualWorld
              ? this.avatarLastKnownPosition.coords.longitude
              : this.lastKnownPosition.coords.longitude,
            this.isVirtualWorld
              ? this.avatarLastKnownPosition.coords.latitude
              : this.lastKnownPosition.coords.latitude,
          ],
        },
      });
      this.map.addLayer({
        id: "geolocate-solution",
        source: "geolocate-solution",
        type: "symbol",
        layout: {
          "icon-image": "geolocate-solution",
          "icon-size": 0.65,
          "icon-offset": [0, 0],
          "icon-allow-overlap": true,
        },
      });
    }

    if (this.task.answer.type == AnswerType.MULTIPLE_CHOICE) {
      this.feedback.solution = this.translate.instant(
        "Feedback.correctAnswerIs1"
      );
      this.feedback.img = this.task.answer.photos[0];
    }

    if (this.task.answer.type == AnswerType.MULTIPLE_CHOICE_TEXT) {
      this.feedback.solution = this.translate.instant(
        "Feedback.correctAnswerIs2",
        { answer: `${this.task.answer.choices[0]}` }
      );
    }

    if (
      this.task.answer.type == AnswerType.MAP_POINT &&
      this.task.type != "theme-loc"
    ) {
      this.showSolutionLandmark(this.task.question.geometry);
    }

    if (this.task.answer.type == AnswerType.MAP_DIRECTION) {
      let position;
      let direction;

      if (this.task.question.direction?.position) {
        position = this.task.question.direction.position.geometry.coordinates;
      } else {
        position = [
          this.lastKnownPosition.coords.longitude,
          this.lastKnownPosition.coords.latitude,
        ];
      }

      if (this.task.question.direction?.bearing) {
        direction = this.task.question.direction.bearing;
      } else {
        direction = this.direction || 0;
      }

      this.map.addSource("direction-solution", {
        type: "geojson",
        data: {
          type: "Point",
          coordinates: position,
        },
      });

      this.map.addLayer({
        id: "direction-solution",
        source: "direction-solution",
        type: "symbol",
        layout: {
          "icon-image": "direction-solution",
          "icon-size": 0.65,
          "icon-offset": [0, -8],
          "icon-rotate": direction,
        },
      });
    }

    if (this.task.answer.type == AnswerType.DIRECTION) {
      let position;

      if (this.task.question.direction?.position) {
        position = this.task.question.direction.position.geometry.coordinates;
      } else {
        position = [
          this.isVirtualWorld
            ? this.avatarLastKnownPosition.coords.longitude
            : this.lastKnownPosition.coords.longitude,
          this.isVirtualWorld
            ? this.avatarLastKnownPosition.coords.latitude
            : this.lastKnownPosition.coords.latitude,
        ];
      }

      this.map.addSource("direction-solution", {
        type: "geojson",
        data: {
          type: "Point",
          coordinates: position,
        },
      });
      this.map.addLayer({
        id: "direction-solution",
        source: "direction-solution",
        type: "symbol",
        layout: {
          "icon-image": "directionv2",
          "icon-size": 0.65,
          "icon-offset": [0, -8],
          "icon-rotate": this.direction ?? 0,
        },
      });
    }

    if (this.task.answer.type == AnswerType.NUMBER) {
      this.feedback.solution = `Die korrekte Lösung ist ${this.task.answer.number}`;
    }

    if (this.task.answer.type == AnswerType.TEXT) {
    }
  }

  public removeSolution() {
    if (this.map.getLayer("geolocate-solution")) {
      this.map.removeLayer("geolocate-solution");
      this.map.removeSource("geolocate-solution");
    }
    if (this.map.getLayer("direction-solution")) {
      this.map.removeLayer("direction-solution");
      this.map.removeSource("direction-solution");
    }
    if (this.map.getLayer("solution-polygon")) {
      this.map.removeLayer("solution-polygon");
      this.map.removeSource("solution-source");
    }
  }

  public showSolutionLandmark(landmark: any) {
    this.removeSolution();

    this.map.addSource("solution-source", {
      type: "geojson",
      data: landmark,
    });
    this.map.addLayer({
      id: "solution-polygon",
      type: "fill-extrusion",
      source: "solution-source",
      filter: ["all", ["==", ["geometry-type"], "Polygon"]],
      paint: {
        "fill-extrusion-color": this.successColor,
        "fill-extrusion-opacity": 0.5,
        "fill-extrusion-height": 20,
      },
    });
  }

  public dismissFeedback() {
    this.showFeedback = false;
    this.feedbackRetry = false;
    this.removeSolution();

    this.changeDetectorRef.detectChanges();
  }

  public remove(): void {
    if (!this.isVirtualWorld) {
      this.positionSubscription.unsubscribe();
      this.deviceOrientationSubscription.unsubscribe();
    } else {
      // VR world
      this.avatarPositionSubscription.unsubscribe();
      this.avatarOrientationSubscription.unsubscribe();
    }
  }

  public onWaypointReached() {
    this.trackerService.addEvent({
      type: "WAYPOINT_REACHED",
    });
    this.initFeedback(true);
  }

  private userDidArrive(waypoint): boolean {
    const targetDistance = this.helperService.getDistanceFromLatLonInM(
      waypoint[1],
      waypoint[0],
      this.isVirtualWorld
        ? this.avatarLastKnownPosition.coords.latitude
        : this.lastKnownPosition.coords.latitude,
      this.isVirtualWorld
        ? this.avatarLastKnownPosition.coords.longitude
        : this.lastKnownPosition.coords.longitude
    );

    // include buidling and non buidling envs
    if (!this.task?.isVEBuilding) {
      this.playingGamePage.targetDistance = targetDistance; // This should prevent updating disance twice as in VE we are getting distance from VE app see `updateAvatarPosition` event in play
      return targetDistance < PlayingGamePage.triggerTreshold;
    } else {
      return this.veBuildingUtilService.isAvatartInDestinationFloor(this.task.floor)
        ? targetDistance < PlayingGamePage.triggerTreshold
        : false;
    }
  }

  get staticShowSuccess() {
    return PlayingGamePage.showSuccess;
  }

  public getMapClickAnswer(
    {
      selectedPhoto,
      isCorrectPhotoSelected,
      selectedChoice,
      isCorrectChoiceSelected,
      photo,
      photoURL,
      directionBearing,
      compassHeading,
      clickDirection,
      numberInput,
      textInput,
    },
    clickPosition
  ) {
    // -------
    // Feedback in Map Click (needs to be in seperate function later on)
    // -------
    let answer;

    if (this.task.answer.type == AnswerType.POSITION) {
      const waypoint = this.task.answer.position.geometry.coordinates;
      const arrived = this.userDidArrive(waypoint);
      answer = {
        target: waypoint,
        position: this.lastKnownPosition,
        distance: this.helperService.getDistanceFromLatLonInM(
          waypoint[1],
          waypoint[0],
          this.isVirtualWorld
            ? this.avatarLastKnownPosition.coords.latitude
            : this.lastKnownPosition.coords.latitude,
          this.isVirtualWorld
            ? this.avatarLastKnownPosition.coords.longitude
            : this.lastKnownPosition.coords.longitude
        ),
        correct: arrived,
      };
    }

    if (this.task.type == "theme-loc") {
      if (this.map.getSource("marker-point")) {
        const distance = this.helperService.getDistanceFromLatLonInM(
          clickPosition[1],
          clickPosition[0],
          this.isVirtualWorld
            ? this.avatarLastKnownPosition.coords.latitude
            : this.lastKnownPosition.coords.latitude,
          this.isVirtualWorld
            ? this.avatarLastKnownPosition.coords.longitude
            : this.lastKnownPosition.coords.longitude
        );
        answer = {
          clickPosition,
          distance,
          correct: distance < PlayingGamePage.triggerTreshold,
        };
      } else {
        answer = {
          clickPosition: undefined,
          distance: undefined,
          correct: false,
        };
      }
    }

    if (this.task.answer.type == AnswerType.MULTIPLE_CHOICE) {
      if (selectedPhoto != null) {
        answer = {
          selectedPhoto,
          correct: isCorrectPhotoSelected,
        };
      } else {
        answer = {
          selectedPhoto: null,
          correct: false,
        };
      }
    }

    if (this.task.answer.type == AnswerType.MULTIPLE_CHOICE_TEXT) {
      if (selectedChoice != null) {
        answer = {
          selectedChoice,
          correct: isCorrectChoiceSelected,
        };
      } else {
        answer = {
          selectedChoice: null,
          correct: false,
        };
      }
    }

    if (this.task.answer.type == AnswerType.PHOTO) {
      if (photo == "") {
        answer = {
          photo: null,
          correct: false,
        };
      } else {
        answer = {
          photo,
          correct: true,
        };
      }
    }

    if (
      this.task.answer.type == AnswerType.MAP_POINT &&
      this.task.type != "theme-loc"
    ) {
      if (this.map.getSource("marker-point")) {
        const isInPolygon = booleanPointInPolygon(
          clickPosition,
          this.task.question.geometry.features[0]
        );
        answer = {
          clickPosition,
          correct: isInPolygon,
        };
      } else {
        answer = {
          clickPosition: undefined,
          correct: false,
        };
      }
    }

    if (this.task.answer.type == AnswerType.DIRECTION) {
      answer = {
        compassHeading,
        correct: this.Math.abs(directionBearing - compassHeading) <= 22.5,
      };
    }

    if (this.task.answer.type == AnswerType.MAP_DIRECTION) {
      let isCorrect = false;
      if (clickDirection != 0) {
        if (
          this.task.question.type == QuestionType.MAP_DIRECTION_PHOTO &&
          this.task.question.direction?.bearing != undefined
        ) {
          isCorrect =
            this.Math.abs(
              clickDirection - this.task.question.direction.bearing
            ) <= this.DIRECTION_TRESHOLD;
        } else {
          isCorrect =
            this.Math.abs(clickDirection - compassHeading) <=
            this.DIRECTION_TRESHOLD;
        }
        answer = {
          clickDirection,
          correct: isCorrect,
        };
      } else {
        answer = {
          compassHeading: undefined,
          correct: isCorrect,
        };
      }
    }

    if (this.task.answer.type == AnswerType.NUMBER) {
      answer = {
        numberInput,
        correct: numberInput == this.task.answer.number,
      };
    }

    if (this.task.answer.type == AnswerType.TEXT) {
      answer = {
        text: textInput,
        correct: textInput != undefined,
      };
    }

    // -------
    // End of Feedback in Map Click (needs to be in seperate function later on)
    // -------

    return answer;
  }
}
