import {
  Component,
  OnInit,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
  Output,
  EventEmitter,
} from "@angular/core";

import { QuestionType, TaskMode } from "./../../../../models/types";
import { PopoverComponent } from "src/app/popover/popover.component";
import { PopoverController } from "@ionic/angular";
import { TranslateService } from "@ngx-translate/core";
import { virEnvLayers } from "src/app/models/virEnvsLayers";

@Component({
  selector: "question-type",
  templateUrl: "./question-type.component.html",
})
export class QuestionTypeComponent implements OnInit, OnChanges {
  @Input() question: any;
  @Input() taskType: string;

  // VR world
  @Input() isVirtualWorld: boolean;
  @Input() isVRMirrored: boolean;
  @Input() virEnvType: string;
  
  // VE building 
  @Input() isVEBuilding: boolean;
  @Input() selectedFloor: string;  // task floor
  @Input() initialFloor: string;  // initial floor
  virEnvLayers = virEnvLayers;
  taskFloorText = '';
  @Output() initialFloorChange=new EventEmitter();

  // Multi-player Mode
  @Input() numPlayers: number;
  @Input() isSingleMode: number;
  @Input() collaborationType: any;

  @Output() questionChange: EventEmitter<any> = new EventEmitter<any>(true);

  questionTypeEnum = QuestionType;
  taskModeEnum = TaskMode;

  initialAvatarPositionStatus = false;

  constructor(
    public popoverController: PopoverController,
    private translate: TranslateService
  ) {}

  ngOnChanges(changes: SimpleChanges): void {
  // console.log("changes (changes): ", changes);
    if (this.isSingleMode) {
      // // console.log("changes (changes.question.currentValue): ", changes.question.currentValue);
      if (changes.question) {
        this.questionChange.emit(changes.question.currentValue);
      }
    } else {
      // // console.log("changes (changes.question.currentValue): ", changes);
      if (changes.question) {
        this.questionChange.emit(changes.question.currentValue);
      }
    }
  }

  /* multi-player */
  onCollTypeChange(collType: any) {
  // console.log("collType:", collType);
  }

  ngOnInit() {
    // Check if question text is empty and set it to the translation key
    this.checkAndUpdateQuestionText();

    if (
      this.isVirtualWorld &&
      this.question &&
      (this.question.initialAvatarPosition || this.initialFloor!="Select floor")
    ) {
      this.initialAvatarPositionStatus = true;
    }

    // Translation
    this.taskFloorText = this.translate.instant("CreateTasks.taskFloor");
  }

  initialAvatarPosToggleChange() {
    //* to remove object from db (when deleting initial position)
    if (!this.initialAvatarPositionStatus) {
      this.question.initialAvatarPosition = undefined;
      if (this.isVEBuilding) {
        this.initialFloor = "Select floor";
        this.onFloorChanged()
      }
    }
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

  onFloorChanged(){
    this.initialFloorChange.emit(this.initialFloor);
  }

  checkAndUpdateQuestionText() {
    if (this.isSingleMode) {
      if (!this.question.text?.trim()) {
        this.question.text = this.translate.instant(this.question.key);
      }
    } else {
      // multi-player mode
      if (!this.question[0].text?.trim()) {
        this.question.forEach((q: any) => {
          q.text = this.translate.instant(q.key);
        });
      }
    }
  }
}
