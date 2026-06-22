import {
  Component,
  OnInit,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
} from "@angular/core";
import { ModalController, PopoverController } from "@ionic/angular";
import { MapFeaturesModalPage } from "./../map-features-modal/map-features-modal.page";
import { QuestionType, AnswerType } from "src/app/models/types";
import { standardMapFeatures } from "src/app/models/standardMapFeatures";
import { cloneDeep } from "lodash";
import { VirEnvHeaders } from "src/app/models/virEnvsHeader";
import { UtilService } from "src/app/services/util.service";
import { TranslateService } from "@ngx-translate/core";
import { virEnvLayers } from "src/app/models/virEnvsLayers";
import { VEBuildingUtilService } from "src/app/services/ve-building-util.service";

@Component({
  selector: "app-create-info-modal",
  templateUrl: "./create-info-modal.component.html",
  styleUrls: ["./create-info-modal.component.scss"],
})
export class CreateInfoModalComponent implements OnInit, OnChanges {
  @Input() task: any;
  @Input() taskNo: number;
  // @Input() question: any;

  // VR world
  @Input() isVirtualWorld: boolean;
  @Input() isVRMirrored: boolean;
  @Input() virEnvType: string;
  @Input() excludedObjectsNames: string[] = [];  //* list of excluded objects from virtual environment
  visibleObjectsNames: string[] = [];  //* UI binding: all objects minus excluded ones
  initialAvatarPositionStatus = false;
  @Input() isSingleMode: boolean;

  // VE building
  public isVEBuilding = false;
  @Input() selectedFloor;
  @Input()initialFloor;  // initial floor
  @Output() selectedFloorChange = new EventEmitter();
  @Output() initialFloorChange=new EventEmitter();
  //* get virual environment headers
  virEnvLayers = virEnvLayers;

  //* get virual environment headers
  virEnvTypesList = VirEnvHeaders;

  @Output() taskChange: EventEmitter<any> = new EventEmitter<any>(true);

  uploading = false;

  constructor(
    public modalController: ModalController,
    public popoverController: PopoverController,
    public utilService: UtilService,
    private veBuildingUtilService: VEBuildingUtilService,
    private translate: TranslateService
  ) {}

  ngOnInit() {
    if (this.task == null) {
      this.task = {
        category: "info",
        question: {
          type: QuestionType.INFO,
          text: "",
          photo: "",
          audio: undefined,
        },
        answer: {
          type: AnswerType.INFO,
        },
        settings: {
          confirmation: true,
        },
        mapFeatures: null,
      };
    }

    if (
      this.isVirtualWorld &&
      this.task.question &&
      (this.task.question.initialAvatarPosition || this.task.initialFloor)
    ) {
        this.initialAvatarPositionStatus = true;
    }

    // Set default avatar-speed and building floor of new tasks
    if (this.isVirtualWorld) {
      if (!this.task.settings.avatarSpeed) {
        this.task.settings.avatarSpeed =
          virEnvLayers[this.virEnvType].defaultAvatarSpeed ?? 2;
      }

      // Set default map size if not set
      if (!this.task.settings.mapSize) {
        this.task.settings.mapSize = "3";
      }

      // check wether selected VE is a building
      this.isVEBuilding = this.veBuildingUtilService.checkVEBuilding(
        this.virEnvType
      );

      // set default floor for new tasks only (not stored ones/when editing a task)
      if (this.isVEBuilding) {
        // In case task floor is not set
        if (!this.selectedFloor) {
          this.selectedFloor = this.veBuildingUtilService.setInitialFloor(this.virEnvType);
        }
        // In case initial floor is not set
        if (!this.initialFloor) {
          this.initialFloor = "Select floor";
        }
      }

      // set default value of excluded objects from virtual environment (for not stored ones/when editing a task)
      this.excludedObjectsNames = this.excludedObjectsNames ?? [];

      // initialize visible objects: all objects minus any already-excluded ones
      const allObjects: string[] = this.virEnvLayers[this.virEnvType]?.objectsList ?? [];
      this.visibleObjectsNames = allObjects.filter(o => !this.excludedObjectsNames.includes(o));
    }
  }

  // handle adding/exclusion selected objects to exclusion list
  onObjectExclusion(event: any) {
    this.visibleObjectsNames = event.detail.value as string[];
    const allObjects: string[] = this.virEnvLayers[this.virEnvType]?.objectsList ?? [];
    this.excludedObjectsNames = allObjects.filter(o => !this.visibleObjectsNames.includes(o));
  }

  ngOnChanges(changes: SimpleChanges): void {
    this.taskChange.emit(this.task);
  }

  async presentMapFeaturesModal() {
    const modal = await this.modalController.create({
      component: MapFeaturesModalPage,
      backdropDismiss: false,
      componentProps: {
        features: this.task.mapFeatures,
        isVirtualWorld: this.isVirtualWorld,
        isVRMirrored: this.isVRMirrored,
        virEnvType: this.virEnvType,
      },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    this.task.mapFeatures = data.data;
    return;
  }

  dismissModal(dismissType: string = "null") {
    if (this.uploading) {
      return;
    }
    if (dismissType == "close") {
      this.modalController.dismiss();
      return;
    }

    // An info task only shows its content to the player, so block saving an empty one
    // (no text, photo or audio) — otherwise the player just gets a bare "okay" button.
    const question = this.task?.question;
    const hasContent = !!(question?.text?.trim() || question?.photo || question?.audio);
    if (!hasContent) {
      this.utilService.showToast(
        this.translate.instant("CreateGame.infoContentRequired"),
        "danger"
      );
      return;
    }

    if (this.task.mapFeatures == undefined) {
      this.task.mapFeatures = cloneDeep(standardMapFeatures);
    }

    this.modalController.dismiss({
      dismissed: true,
      data: this.task,
    });

    //* inlclude vir. env. type in task data
    if (this.isVirtualWorld) {
      this.task.virEnvType = this.virEnvType;
    }

    //* inlclude is building properties in task data
    if (this.isVEBuilding) {
      this.task.isVEBuilding = this.isVEBuilding;
      this.task.floor = this.selectedFloor;
      this.task.initialFloor = this.initialFloor!="Select floor"?this.initialFloor:undefined;
    }

    // include excluded objects from virtual environment in task data
    if (this.isVirtualWorld) {
      this.task.excludedObjectsNames = this.excludedObjectsNames?.length > 0 ? this.excludedObjectsNames : [];
    }
  }

  // TODO: Do we sill need it??
  initialAvatarPosToggleChange() {
    //* to remove object from db (when deleting initial position)    
    if (!this.initialAvatarPositionStatus) {
      this.task.question.initialAvatarPosition = undefined;
      if (this.isVEBuilding) {
        this.task.initialFloor = this.initialFloor = "Select floor";
        this.onFloorChanged()
      }
    }
  }

  onFloorChanged(){
    this.initialFloorChange.emit(this.initialFloor);
  }

  checkVEBuilding(){
    return virEnvLayers[this.virEnvType].isVEBuilding ?? false;
  }

  // Set default avatar-speed when vir. env. is changed
  onEnvChanged(){
      this.task.settings.avatarSpeed =
        virEnvLayers[this.virEnvType].defaultAvatarSpeed ?? 2;
      this.isVEBuilding = this.veBuildingUtilService.checkVEBuilding(
        this.virEnvType
      );
  }
}
