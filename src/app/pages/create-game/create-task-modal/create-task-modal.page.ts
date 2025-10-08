import { Component, Input, OnInit } from "@angular/core";
import { ModalController } from "@ionic/angular";
import { cloneDeep } from "lodash";

import { navtasks } from "../../../models/navigation-tasks";
import { themetasks } from "./../../../models/theme-tasks";

import { standardMapFeatures } from "../../../models/standardMapFeatures";

// import { FieldConfig } from "./../../../dynamic-form/models/field-config";
// import { DynamicFormComponent } from "./../../../dynamic-form/container/dynamic-form.component";
import { MapFeaturesModalPage } from "./../map-features-modal/map-features-modal.page";
import { QuestionType, AnswerType, TaskMode } from "src/app/models/types";
import { PopoverController } from "@ionic/angular";
import { PopoverComponent } from "src/app/popover/popover.component";
import { TranslateService } from "@ngx-translate/core";
import { navtasksMultiplayers3 } from "src/app/models/navigation-tasks-multi_3_players";
import { navtasksMultiplayers2 } from "src/app/models/navigation-tasks-multi_2_players";
import { themetasksMultiplayers3 } from "src/app/models/theme-tasks-multi-3-players";
import { themetasksMultiplayers2 } from "src/app/models/theme-tasks-multi-2-players";
import { VirEnvHeaders } from "src/app/models/virEnvsHeader";
import { virEnvLayers } from "src/app/models/virEnvsLayers";

@Component({
  selector: "app-create-task-modal",
  templateUrl: "./create-task-modal.page.html",
  styleUrls: ["./create-task-modal.page.scss"],
})
export class CreateTaskModalPage implements OnInit {
  @Input() gameName = "";
  @Input() type = "nav";
  @Input() task: any = {};
  @Input() taskNo: number;

  // VR world
  @Input() isVirtualWorld: boolean;
  @Input() isVRMirrored: boolean;
  @Input() virEnvType: string;
  @Input() excludedObjectsVirEnv: string[] = [];  //* list of excluded objects from virtual environment
  
  
  // VE building
  public isVEBuilding = false;
  @Input() selectedFloor;  // task floor
  @Input()initialFloor;  // initial floor
  taskFloorText = '';
  
  // initialFloor = "Select floor";

  // Multi-player Mode
  @Input() numPlayers: Number;
  @Input() isSingleMode: boolean;

  tasks: any[] = [];

  mapFeatures: any = this.task.mapFeatures;

  showFeedback = true;
  showMultipleTries = true;
  defaultTaskAccuracy = 3; // default accuracy for tasks

  // step = 5;

  objectQuestionSelect: any[] = [];
  objectAnswerSelect: any[] = [];

  freeQuestionSelect: any[] = [
    QuestionType.TEXT,
    QuestionType.MAP_FEATURE_FREE,
    QuestionType.PHOTO,
  ];
  freeAnswerSelect: any[] = [
    AnswerType.MULTIPLE_CHOICE,
    AnswerType.PHOTO,
    AnswerType.MULTIPLE_CHOICE_TEXT,
    AnswerType.TEXT,
    AnswerType.NUMBER,
    AnswerType.DRAW,
  ];

  taskTypes: any[] = [
    {
      type: 1,
      text: this.translate.instant("Tasktypes.selfLocation"),
    },
    {
      type: 2,
      text: this.translate.instant("Tasktypes.objectLocation"),
    },
    {
      type: 3,
      text: this.translate.instant("Tasktypes.directionDetermination"),
    },
    {
      type: 4,
      text: this.translate.instant("Tasktypes.freeTasks"),
    },
  ];

  selectedThemeTaskType: any;

  objectQuestionTemplate = [
    QuestionType.MAP_FEATURE,
    QuestionType.MAP_FEATURE_PHOTO,
    QuestionType.MAP_DIRECTION_MARKER,
    QuestionType.MAP_DIRECTION,
    QuestionType.MAP_DIRECTION_PHOTO,
    QuestionType.TEXT,
  ];

  viewDirectionSetPosition = false;

  // mutiplayer - collaboration methods
  collaborationTypes: any[] = [
    {
      type: "1-1",
      text: "Each player has a unique task instruction (1-1)",
    },
    {
      type: "sequential",
      text: "All players have same task instruction (sequential)",
    },
    /* {
      type: "leader-follower",
      text: "Only one player can see the instruction (leader & follower)"
    }, */ {
      type: "freeChoice",
      text: "Free choice",
    },
  ];
  // selectedcollMethodType: any;
  selectedCollType: any;

  //* get virual environment headers
  virEnvTypesList = VirEnvHeaders;
  //* Get virtual environment layers
  virEnvLayers = virEnvLayers;
  
  // handle adding selected objects to exclusion list
  onObjectExclusion(event: any) {
    const selectedValue = event.detail.value as string[];
    // Find the newly added item(s)
    const newlySelected = selectedValue.filter(x => !this.excludedObjectsVirEnv.includes(x));
    // Add new ones to main list
    this.excludedObjectsVirEnv.push(...newlySelected);
  }

  constructor(
    public modalController: ModalController,
    public popoverController: PopoverController,
    private translate: TranslateService
  ) {}

  ngOnInit() {
    if (this.type == "nav") {
      if (this.isSingleMode) {
        this.tasks = cloneDeep(navtasks);
      } else {
        switch (this.numPlayers) {
          case 2:
            this.tasks = cloneDeep(navtasksMultiplayers2);
            break;
          case 3:
            this.tasks = cloneDeep(navtasksMultiplayers3);
            break;
        }
        // // console.log("////navtasksMultiplayers: ", this.tasks)
      }
    } else {
      if (this.isSingleMode) {
        this.tasks = cloneDeep(themetasks);
      } else {
        switch (this.numPlayers) {
          case 2:
            this.tasks = cloneDeep(themetasksMultiplayers2);
            break;
          case 3:
            this.tasks = cloneDeep(themetasksMultiplayers3);
            break;
        }
      }
    }

    //* in case the task is already created
    if (this.task == null) {
      this.task = this.tasks[0];
      this.selectedThemeTaskType = this.taskTypes[0];

      // (mutli-player): 1-1 is the default collaboration type
      if (!this.isSingleMode) {
        this.selectedCollType = this.collaborationTypes[0];
      }

      this.task.settings = {
        feedback: true,
        multipleTries: true,
        confirmation: this.task.category.includes("theme"),
        accuracy: this.defaultTaskAccuracy,
        showMarker: true,
        keepMarker: false,
        keepDrawing: "current",
        drawPointOnly: false,
      };

      this.settingsChange();
    } else {
      if (this.task.type.includes("loc")) {
        this.selectedThemeTaskType = this.taskTypes[0];
      }
      if (this.task.type.includes("object")) {
        this.selectedThemeTaskType = this.taskTypes[1];
      }
      if (this.task.type.includes("direction")) {
        this.selectedThemeTaskType = this.taskTypes[2];
      }
      if (this.task.type.includes("free")) {
        this.selectedThemeTaskType = this.taskTypes[3];
      }

      //* (mutli-player): when task is not null, retreive selected coll. type
      if (!this.isSingleMode) {
        //* as we only store type in db without text we need to retreive it using index
        let index = this.collaborationTypes.findIndex(
          (el) => el.type == this.task.collaborationType
        );
        this.selectedCollType = this.collaborationTypes[index];
      }
    }
    // this.onTaskSelected(this.task);
    this.onTaskSelected(cloneDeep(this.task));

    // Set default avatar-speed  and map size of new tasks
    if (this.isVirtualWorld) {
      // Set default avatar speed if not set
      if (!this.task.settings.avatarSpeed && this.task.settings.avatarSpeed!= 0) {
        this.task.settings.avatarSpeed =
          virEnvLayers[this.virEnvType].defaultAvatarSpeed ?? 2;
      }

      // Set default map size if not set
      if (!this.task.settings.mapSize) {
        this.task.settings.mapSize = "3";
      }

      // check wether selected VE is a building
      this.isVEBuilding = this.checkVEBuilding();
      
      // set default floor for new tasks only (not stored ones/when editing a task)
      if (this.isVEBuilding) {
        // In case task floor is not set
        if (!this.selectedFloor) {
          this.selectedFloor = this.setInitialFloor();
        }
        // In case initial floor is not set
        if (!this.initialFloor) {
          this.initialFloor = "Select floor";
        }
      }

      // set default value of excluded objects from virtual environment (for not stored ones/when editing a task)
      this.excludedObjectsVirEnv = this.excludedObjectsVirEnv ?? [];
    }

    // Translation
    this.taskFloorText = this.translate.instant("CreateTasks.taskFloor");
  }

  onThemeTaskTypeChange(taskType) {
    if (taskType.type == 1) {
      this.task = this.tasks[0];
    } else if (taskType.type == 2) {
      this.task = this.tasks[1];
    } else if (taskType.type == 3) {
      this.task = this.tasks[7];
    } else {
      if (this.isSingleMode) {
        this.task = {
          name: this.translate.instant("Tasktypes.freeTask"),
          type: "free",
          category: "theme",
          question: {
            type: QuestionType.TEXT,
            text: "",
          },
          answer: {
            type: AnswerType.MULTIPLE_CHOICE,
          },
        };
      } else {
        if (this.numPlayers == 2) {
          this.task = {
            name: this.translate.instant("Tasktypes.freeTask"),
            type: "free",
            category: "theme",
            question: [
              {
                type: QuestionType.TEXT,
                text: "",
              },
              {
                type: QuestionType.TEXT,
                text: "",
              },
            ],
            answer: [
              {
                type: AnswerType.MULTIPLE_CHOICE,
              },
              {
                type: AnswerType.MULTIPLE_CHOICE,
              },
            ],
          };
        } else {
          this.task = {
            name: this.translate.instant("Tasktypes.freeTask"),
            type: "free",
            category: "theme",
            question: [
              {
                type: QuestionType.TEXT,
                text: "",
              },
              {
                type: QuestionType.TEXT,
                text: "",
              },
              {
                type: QuestionType.TEXT,
                text: "",
              },
            ],
            answer: [
              {
                type: AnswerType.MULTIPLE_CHOICE,
              },
              {
                type: AnswerType.MULTIPLE_CHOICE,
              },
              {
                type: AnswerType.MULTIPLE_CHOICE,
              },
            ],
          };
        }
      }
    }
    this.onTaskSelected(this.task);
  }

  onTaskSelected(newValue) {
    // // console.log("//// newValue:", newValue)

    this.task = newValue;

    // Check if question text is empty and set it to the translation key - after changing task type
    // Note: excluding free tasks as they have no question text
    if (
      this.task.type != "free"
    ) {
      this.checkAndUpdateQuestionText();
    }
    

    if (!this.task.settings || Object.keys(this.task.settings).length == 0) {
      this.task.settings = {
        feedback: true,
        multipleTries: true,
        confirmation: this.task.category.includes("theme"),
        accuracy: this.defaultTaskAccuracy,
        showMarker: true,
        keepMarker: false,
        keepDrawing: "current",
        drawPointOnly: false,
      };
    }

    this.settingsChange();

    this.mapFeatures = this.task.mapFeatures;

    /*  */
    if (this.task.type == "free") {
      this.objectQuestionSelect = this.freeQuestionSelect.map((t) => ({
        type: t as QuestionType,
        text: t,
      }));
      // // console.log("//// objectQuestionSelect:  ", this.objectQuestionSelect)
      this.objectAnswerSelect = this.freeAnswerSelect.map((t) => ({
        type: t as AnswerType,
        text: t,
      }));
      // // console.log("//// objectAnswerSelect:  ", this.objectAnswerSelect)

      /* single-player */
      if (this.isSingleMode) {
        if (
          this.task.answer.type == AnswerType.PHOTO ||
          this.task.answer.type == AnswerType.TEXT
        ) {
          this.task.settings.feedback = false;
          this.task.settings.multipleTries = false;
          this.showFeedback = false;
          this.showMultipleTries = false;
        }

        if (this.task.answer.type == AnswerType.DRAW) {
          this.task.settings.feedback = false;
          this.task.settings.multipleTries = false;
          this.showFeedback = false;
          this.showMultipleTries = false;
        }
      } else {
        /* multi-player */
        if (
          this.task.answer[0].type == AnswerType.PHOTO ||
          this.task.answer[0].type == AnswerType.TEXT
        ) {
          this.task.settings.feedback = false;
          this.task.settings.multipleTries = false;
          this.showFeedback = false;
          this.showMultipleTries = false;
        }

        if (this.task.answer[0].type == AnswerType.DRAW) {
          this.task.settings.feedback = false;
          this.task.settings.multipleTries = false;
          this.showFeedback = false;
          this.showMultipleTries = false;
        }
      }
    } else {
      // // console.log("//// (onTaskSelected) 1a - this.tasks", this.tasks);
      this.objectQuestionSelect = Array.from(
        new Set(
          this.tasks
            .filter((t) => t.type == this.task.type)
            .map((t) =>
              this.isSingleMode ? t.question.type : t.question[0].type
            ) // DoDo
        )
      )
        .map((t) => ({ type: t as QuestionType, text: t }))
        .sort(
          // DoDo
          (a, b) =>
            this.objectQuestionTemplate.indexOf(a.type) -
            this.objectQuestionTemplate.indexOf(b.type)
        );

      // multi-player impl.
      if (this.isSingleMode) {
        const similarTypes = cloneDeep(themetasks).filter(
          (t) => t.type == this.task.type
        );

        const similarQ = similarTypes.filter(
          (t) => t.question.type == this.task.question.type
        );

        this.objectAnswerSelect = Array.from(
          new Set(
            similarQ.map((t) => ({
              type: t.answer.type as AnswerType,
              text: t.answer.type,
            }))
          )
        );

        if (
          this.task.type == "theme-direction" &&
          this.task.question.type == "TEXT" &&
          this.task.answer.type == "MAP_DIRECTION"
        ) {
          if (this.task.question.direction == undefined) {
            this.task.question.direction = {};
          }
          if (this.task.question.direction.position != undefined) {
            this.viewDirectionSetPosition = true;
          } else {
            this.viewDirectionSetPosition = false;
          }
        }
      } else {
        const similarTypes = cloneDeep(
          this.numPlayers == 2
            ? themetasksMultiplayers2
            : themetasksMultiplayers3
        ).filter((t) => t.type == this.task.type);

        const similarQ = similarTypes.filter(
          (t) => t.question[0].type == this.task.question[0].type
        );

        this.objectAnswerSelect = Array.from(
          new Set(
            similarQ.map((t) => ({
              type: t.answer[0].type as AnswerType,
              text: t.answer[0].type,
            }))
          )
        );

        if (
          this.task.type == "theme-direction" &&
          this.task.question[0].type == "TEXT" &&
          this.task.answer[0].type == "MAP_DIRECTION"
        ) {
          if (this.task.question[0].direction == undefined) {
            this.task.question[0].direction = {};
          }
          if (this.task.question[0].direction.position != undefined) {
            this.viewDirectionSetPosition = true;
          } else {
            this.viewDirectionSetPosition = false;
          }
        }
      }
    }
  }

  /* on selecting a  */
  onObjectQuestionSelectChange() {
  // console.log("//// o.q.s.c 0 - this.task.type", this.task.type);

    if (this.isSingleMode) {
      if (this.task.type != "free") {
        // // console.log("//// o.q.s.c 1 - free");

        const similarTypes = cloneDeep(themetasks).filter(
          (t) => t.type == this.task.type
        );

        const similarQ = similarTypes.filter(
          (t) => t.question.type == this.task.question.type
        );

        this.onTaskSelected(similarQ[0]);

        this.objectAnswerSelect = Array.from(
          new Set(
            similarQ.map((t) => ({
              type: t.answer.type as AnswerType,
              text: t.answer.type,
            }))
          )
        );

        if (this.task.question.type == QuestionType.MAP_DIRECTION) {
          this.task.settings.multipleTries = false;
          this.showMultipleTries = false;
        } else {
          this.task.settings.multipleTries = true;
          this.showMultipleTries = true;
        }
      }
    } else {
      if (this.task.type != "free") {
        const similarTypes = cloneDeep(
          this.numPlayers == 2
            ? themetasksMultiplayers2
            : themetasksMultiplayers3
        ).filter((t) => t.type == this.task.type);

        const similarQ = similarTypes.filter(
          (t) => t.question[0].type == this.task.question[0].type
        );

        this.onTaskSelected(similarQ[0]);

        this.objectAnswerSelect = Array.from(
          new Set(
            similarQ.map((t) => ({
              type: t.answer[0].type as AnswerType,
              text: t.answer[0].type,
            }))
          )
        );

        if (this.task.question[0].type == QuestionType.MAP_DIRECTION) {
          this.task.settings.multipleTries = false;
          this.showMultipleTries = false;
        } else {
          this.task.settings.multipleTries = true;
          this.showMultipleTries = true;
        }
      }
    }
  }

  onObjectAnswerSelectChange() {
    if (this.isSingleMode) {
      // Single-player impl
      if (this.task.type != "free") {
        const similarTypes = cloneDeep(themetasks).filter(
          (t) => t.type == this.task.type
        );

        const similarQ = similarTypes.filter(
          (t) =>
            t.question.type == this.task.question.type &&
            t.answer.type == this.task.answer.type
        );

        this.onTaskSelected(similarQ[0]);
      }

      if (
        this.task.answer.type == AnswerType.PHOTO ||
        this.task.answer.type == AnswerType.TEXT
      ) {
        this.task.settings.feedback = false;
        this.task.settings.multipleTries = false;
        this.showFeedback = false;
        this.showMultipleTries = false;
      } else if (this.task.answer.type == AnswerType.DRAW) {
        this.task.settings.feedback = false;
        this.task.settings.multipleTries = false;
        this.showFeedback = false;
        this.showMultipleTries = false;
      } else {
        this.task.settings.feedback = true;
        this.task.settings.multipleTries = true;
        this.showFeedback = true;
        this.showMultipleTries = true;
      }
    } else {
      // Multi-player impl
      if (this.task.type != "free") {
        const similarTypes = cloneDeep(
          this.numPlayers == 2
            ? themetasksMultiplayers2
            : themetasksMultiplayers3
        ).filter((t) => t.type == this.task.type);

        const similarQ = similarTypes.filter(
          (t) =>
            t.question[0].type == this.task.question[0].type &&
            t.answer[0].type == this.task.answer[0].type
        );

        this.onTaskSelected(similarQ[0]);
      }

      if (
        this.task.answer[0].type == AnswerType.PHOTO ||
        this.task.answer[0].type == AnswerType.TEXT
      ) {
        this.task.settings.feedback = false;
        this.task.settings.multipleTries = false;
        this.showFeedback = false;
        this.showMultipleTries = false;
      } else if (this.task.answer[0].type == AnswerType.DRAW) {
        this.task.settings.feedback = false;
        this.task.settings.multipleTries = false;
        this.showFeedback = false;
        this.showMultipleTries = false;
      } else {
        this.task.settings.feedback = true;
        this.task.settings.multipleTries = true;
        this.showFeedback = true;
        this.showMultipleTries = true;
      }
    }
  }

  // Don't know the reason for adding this impl. but I commented it out as we need to show a correct accuracy value
  /* rangeChange() {
    this.step = this.task.settings.accuracy <= 5 ? 1 : 5;
  } */

  feedbackChange() {
    this.task.settings.multipleTries = this.task.settings.feedback;
    if (this.task.category == "nav" && !this.task.settings.confirmation) {
      this.showMultipleTries = false;
      this.task.settings.multipleTries = false;
    }
  }

  settingsChange(event: any = undefined) {
    this.showFeedback = true;
    this.showMultipleTries = true;

    if (this.task.category == "nav" && !this.task.settings.confirmation) {
      this.showMultipleTries = false;
      this.task.settings.multipleTries = false;
    }

    if (
      (this.task.type == "nav-text" || this.task.type == "nav-photo") &&
      !this.task.settings.showMarker
    ) {
      this.task.settings.keepMarker = false;
    }

    if (this.task.category == "nav" && event === true) {
      this.showMultipleTries = true;
      this.task.settings.multipleTries = true;
    }

    if (this.task.answer.type == AnswerType.PHOTO) {
      this.task.settings.feedback = false;

      this.showFeedback = false;
      this.showMultipleTries = false;
    }

    // Add answer hints for feedback of MAP_DIRECTION type
    // Disable multipleTries of some tasks inluding (nav-tasks, ....)
    // DoDo : add them in a model as with navtasks and themetasks
    if (this.isSingleMode) {
      if (
        this.task.answer.mode == TaskMode.NAV_ARROW ||
        this.task.question.type == QuestionType.NAV_INSTRUCTION ||
        this.task.question.type == QuestionType.NAV_INSTRUCTION_PHOTO ||
        this.task.answer.type == AnswerType.PHOTO ||
        (this.task.type == "nav-flag" && !this.task.settings.confirmation)
      ) {
        this.task.settings.multipleTries = false;

        this.showMultipleTries = false;
      }

      if (
        ( (this.task.answer.type == AnswerType.MAP_DIRECTION && this.task.settings.feedback) ||
          this.task.answer.type === AnswerType.DIRECTION) &&
        this.task.settings.feedback &&
        this.task.settings.multipleTries &&
        !this.task.answer.hints
      ) {
        this.task.answer.hints = [
          "Probiere es noch einmal",
          "Probiere es noch einmal",
          "Probiere es noch einmal",
        ];
      }
    } else {
      if (
        this.task.answer[0].mode == TaskMode.NAV_ARROW ||
        this.task.question[0].type == QuestionType.NAV_INSTRUCTION ||
        this.task.question[0].type == QuestionType.NAV_INSTRUCTION_PHOTO ||
        this.task.answer[0].type == AnswerType.PHOTO ||
        (this.task.type == "nav-flag" && !this.task.settings.confirmation)
      ) {
        this.task.settings.multipleTries = false;

        this.showMultipleTries = false;
      }

      if (
        (this.task.answer[0].type == AnswerType.MAP_DIRECTION ||
          this.task.answer[0].type === AnswerType.DIRECTION) &&
        this.task.settings.feedback &&
        this.task.settings.multipleTries &&
        !this.task.answer[0].hints
      ) {
        let hintsList = [
          "Probiere es noch einmal",
          "Probiere es noch einmal",
          "Probiere es noch einmal",
        ];
        this.task.answer[0].hints = cloneDeep(hintsList);
        this.task.answer[1].hints = cloneDeep(hintsList);
        if (this.numPlayers == 3) {
          this.task.answer[2].hints = cloneDeep(hintsList);
        }
      }
    }
  }

  selectCompare(task1, task2) {
    if (task1 == null || task2 == null) {
      return false;
    }
    return task1.type == task2.type;
  }

  async presentMapFeaturesModal() {
    const modal = await this.modalController.create({
      component: MapFeaturesModalPage,
      backdropDismiss: false,
      componentProps: {
        features: this.mapFeatures,
        isVirtualWorld: this.isVirtualWorld,
        isVRMirrored: this.isVRMirrored,
        virEnvType: this.virEnvType,
      },
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data != undefined) {
      this.mapFeatures = data.data;
    }
    return;
  }

  dismissModal(dismissType: string = "null") {

      console.log("----- 🚀 ~ CreateTaskModalPage ~ excludedObjects:", this.excludedObjectsVirEnv)

    if (dismissType == "close") {
      this.modalController.dismiss();
      return;
    }

    if (this.mapFeatures == undefined) {
      this.mapFeatures = cloneDeep(standardMapFeatures);
    }

    if (this.task.settings.accuracy > 5 && this.task.settings.accuracy < 10) {
      this.task.settings.accuracy = 5;
    }

    if (this.task.question.area?.features?.length <= 0) {
      this.task.question.area = undefined;
    }

    if (
      this.task.type == "theme-direction" &&
      this.task.question.type == "TEXT" &&
      this.task.answer.type == "MAP_DIRECTION"
    ) {
      if (this.viewDirectionSetPosition == false) {
        this.task.question.direction.position = undefined;
      }
    }

    //* inlclude vir. env. type in task data
    if (this.isVirtualWorld) {
      this.task.virEnvType = this.virEnvType;
    }

    //* inlclude building properties in task data
    if (this.isVEBuilding) {
      this.task.isVEBuilding = this.isVEBuilding;
      this.task.floor = this.selectedFloor;
      this.task.initialFloor = this.initialFloor!="Select floor"?this.initialFloor:undefined;
    }

    // include excluded objects from virtual environment in task data
    if (this.isVirtualWorld && this.excludedObjectsVirEnv?.length>0) {
      this.task.excludedObjectsVirEnv = this.excludedObjectsVirEnv;
    }

    /* multi-player */
    // set whether all palyers have same question and/or answer
    if (!this.isSingleMode) {
      // save coll method type
      this.task.collaborationType = this.selectedCollType.type;

      // update answers of multiplayers based on collaboration type
      this.updatePlayersAnswers();
    }

    this.modalController.dismiss({
      dismissed: true,
      data: {
        ...this.task,
        mapFeatures: this.mapFeatures,
      },
    });
  }

  async showPopover(ev: any, key: string) {
    let text = this.translate.instant(key);

    const popover = await this.popoverController.create({
      component: PopoverComponent,
      event: ev,
      translucent: true,
      componentProps: { text },
    });
    return await popover.present();
  }

  // Set default avatar-speed when vir. env. is changed
  onEnvChanged(){
      this.task.settings.avatarSpeed =
        virEnvLayers[this.virEnvType].defaultAvatarSpeed ?? 2;
      this.isVEBuilding = this.checkVEBuilding();
      
  }

  checkVEBuilding(){
    return virEnvLayers[this.virEnvType].isVEBuilding ?? false;
  }

  setInitialFloor(){
    let selectedEnv = virEnvLayers[this.virEnvType];
    let defaultFloor = selectedEnv.defaultFloor;
    return selectedEnv.floors[defaultFloor].tag;
  }

  /**
   *  This function updates answers of 2nd and 3rd player based on selected collaboration type 
   */
  updatePlayersAnswers(){
      // only for sequential and free choice
      if (this.selectedCollType.type == "freeChoice") {
        /* Question types */
        if (this.task.question[0].allHaveSameInstruction) {
        // console.log("/// same Instruction ");
          this.task.question[1].text = this.task.question[0].text;
          if (this.numPlayers == 3) {
            this.task.question[2].text = this.task.question[0].text;
          }
        }
        if (this.task.question[0].allHaveSameAudio) {
        // console.log("/// same audios ");
          this.task.question[1].audio = this.task.question[0].audio;
          if (this.numPlayers == 3) {
            this.task.question[2].audio = this.task.question[0].audio;
          }
        }
        if (this.task.question[0].allHasSameMarkObj) {
        // console.log("/// same mark obbject ");
          this.task.question[1].geometry = this.task.question[0].geometry;
          if (this.numPlayers == 3) {
            this.task.question[2].geometry = this.task.question[0].geometry;
          }
        }
        if (this.task.question[0].allHasSameInstPhoto) {
        // console.log("/// same mark obbject ");
          this.task.question[1].text = this.task.question[0].text;
          this.task.question[1].photo = this.task.question[0].photo;
          if (this.numPlayers == 3) {
            this.task.question[2].text = this.task.question[0].text;
            this.task.question[2].photo = this.task.question[0].photo;
          }
        }
        if (this.task.question[0].allHasSameMapMark) {
        // console.log("/// same map mark ");
          this.task.question[1].geometry = this.task.question[0].geometry;
          if (this.numPlayers == 3) {
            this.task.question[2].geometry = this.task.question[0].geometry;
          }
        }
        if (this.task.question[0].allHasSameMarkObjMode) {
        // console.log("/// same Mark object (TaskMode.NO_FEATURE)");
          this.task.question[1].geometry = this.task.question[0].geometry;
          if (this.numPlayers == 3) {
            this.task.question[2].geometry = this.task.question[0].geometry;
          }
        }
        if (this.task.question[0].allHasSamePhotoMarkObj) {
        // console.log("/// same Photo of the objec");
          this.task.question[1].geometry = this.task.question[0].geometry;
          this.task.question[1].photo = this.task.question[0].photo;

          if (this.numPlayers == 3) {
            this.task.question[2].geometry = this.task.question[0].geometry;
            this.task.question[2].photo = this.task.question[0].photo;
          }
        }
        if (this.task.question[0].allHasSameViewDirec) {
        // console.log("/// same view direction");
          this.task.question[1].direction = this.task.question[0].direction;
          if (this.numPlayers == 3) {
            this.task.question[2].direction = this.task.question[0].direction;
          }
        }
        if (this.task.question[0].allHasSameDirMap) {
        // console.log("/// same direction on map");
          this.task.question[1].direction = this.task.question[0].direction;
          if (this.numPlayers == 3) {
            this.task.question[2].direction = this.task.question[0].direction;
          }
        }
        if (this.task.question[0].allHasSamePhotoDirMap) {
        // console.log("/// same Photo and direction n map");
          this.task.question[1].direction = this.task.question[0].direction;
          this.task.question[1].photo = this.task.question[0].photo;

          if (this.numPlayers == 3) {
            this.task.question[2].direction = this.task.question[0].direction;
            this.task.question[2].photo = this.task.question[0].photo;
          }
        }
        if (this.task.question[0].allHasSamePhotoTask) {
        // console.log("/// same Photo for the task");
          this.task.question[1].photo = this.task.question[0].photo;

          if (this.numPlayers == 3) {
            this.task.question[2].photo = this.task.question[0].photo;
          }
        }

        /* Answer types */
        if (this.task.answer[0].allHasSameDes) {
        // console.log("/// same allHasSameDes");
          this.task.answer[1].position = this.task.answer[0].position;

          if (this.numPlayers == 3) {
            this.task.answer[2].position = this.task.answer[0].position;
          }
        }

        if (this.task.answer[0].allHaveSameMultiChoicePhoto) {
        // console.log("/// same allHaveSameMultiChoicePhoto");
          this.task.answer[1].hints = this.task.answer[0].hints;
          this.task.answer[1].photos = this.task.answer[0].photos;

          if (this.numPlayers == 3) {
            this.task.answer[2].hints = this.task.answer[0].hints;
            this.task.answer[2].photos = this.task.answer[0].photos;
          }
        }

        if (this.task.answer[0].allHaveSameMultiChoiceText) {
        // console.log("/// same allHaveSameMultiChoiceText");
          this.task.answer[1].hints = this.task.answer[0].hints;
          this.task.answer[1].choices = this.task.answer[0].choices;

          if (this.numPlayers == 3) {
            this.task.answer[2].hints = this.task.answer[0].hints;
            this.task.answer[2].choices = this.task.answer[0].choices;
          }
        }

        if (this.task.answer[0].allHaveSameCorrAnswer) {
        // console.log("/// same allHaveSameCorrAnswer");
          this.task.answer[1].number = this.task.answer[0].number;

          if (this.numPlayers == 3) {
            this.task.answer[2].number = this.task.answer[0].number;
          }
        }

        if (this.task.answer[0].allHaveSameDirfeedback) {
        // console.log("/// same feedbak");
          this.task.answer[1].hints[0] = this.task.answer[0].hints[0];
          this.task.answer[1].hints[1] = this.task.answer[0].hints[1];
          this.task.answer[1].hints[2] = this.task.answer[0].hints[2];

          if (this.numPlayers == 3) {
            this.task.answer[2].hints[0] = this.task.answer[0].hints[0];
            this.task.answer[2].hints[1] = this.task.answer[0].hints[1];
            this.task.answer[2].hints[2] = this.task.answer[0].hints[2];
          }
        }
      }
      // only for 1-1 option
      // update answer types of 2nd and 3rd players
      else if(this.selectedCollType.type == "1-1"){
        this.task.answer[1].type = this.task.answer[0].type;
        if (this.numPlayers == 3) {
          this.task.answer[2].type = this.task.answer[0].type;
        }
      }
  }

  checkAndUpdateQuestionText() {
    if (this.isSingleMode) {
      if (!this.task.question.text?.trim()) {
        this.task.question.text = this.translate.instant(this.task.question.key);
      }
    } else {
      // multi-player mode
      if (!this.task.question[0].text?.trim()) {
        this.task.question.forEach((q: any) => {
          q.text = this.translate.instant(q.key);
        });
      }
    }
  }
}
