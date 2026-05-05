import { Component, OnInit } from "@angular/core";
import { LanguageService } from "src/app/services/language.service";

@Component({
  selector: "app-handbook",
  templateUrl: "./handbook.component.html",
  styleUrls: ["./handbook.component.scss"],
})
export class HandbookComponent implements OnInit {
  languages = this.languageService.getLangauges();

  sections = [
    /* Real world */
    {
      titleKey: "Handbook.realWorld.sectionTitle",
      subsections: [
        {
          headingKey: "Handbook.realWorld.playGame.heading",
          path: "assets/handbook/spiel_spielen",
          content: [
            { textKey: "Handbook.realWorld.playGame.content.0", images: ["1"] },
            { textKey: "Handbook.realWorld.playGame.content.1", images: ["2", "3"] },
            { textKey: "Handbook.realWorld.playGame.content.2", images: ["4"] },
          ],
        },
        {
          headingKey: "Handbook.realWorld.createGame.heading",
          path: "assets/handbook/spiel_erstellen",
          content: [
            { textKey: "Handbook.realWorld.createGame.content.0", images: ["1"] },
            { textKey: "Handbook.realWorld.createGame.content.1", images: ["2", "3", "4"] },
            { textKey: "Handbook.realWorld.createGame.content.2", images: ["5"] },
          ],
        },
        {
          headingKey: "Handbook.realWorld.editGame.heading",
          path: "assets/handbook/spiel_bearbeiten",
          content: [
            { textKey: "Handbook.realWorld.editGame.content.0", images: ["1"] },
            { textKey: "Handbook.realWorld.editGame.content.1", images: ["2"] },
            { textKey: "Handbook.realWorld.editGame.content.2", images: ["3"] },
            { textKey: "Handbook.realWorld.editGame.content.3", images: ["4"] },
          ],
        },
      ],
    },
    /* Task types */
    {
      titleKey: "Handbook.taskTypes.sectionTitle",
      subsections: [
        {
          headingKey: "Handbook.taskTypes.navigation.heading",
          path: "assets/handbook/aufgabentypen/navigationsaufgaben",
          content: [
            { textKey: "Handbook.taskTypes.navigation.content.0", images: ["1"] },
            { textKey: "Handbook.taskTypes.navigation.content.1", images: ["2"] },
            { textKey: "Handbook.taskTypes.navigation.content.2", images: ["3"] },
          ],
        },
        {
          headingKey: "Handbook.taskTypes.orientation.heading",
          path: "assets/handbook/aufgabentypen/orientierungsaufgaben",
          content: [
            { textKey: "Handbook.taskTypes.orientation.content.0", images: ["1"] },
            { textKey: "Handbook.taskTypes.orientation.content.1", images: ["2"] },
            { textKey: "Handbook.taskTypes.orientation.content.2", images: ["3"] },
          ],
        },
        {
          headingKey: "Handbook.taskTypes.free.heading",
          path: "assets/handbook/aufgabentypen/freie_aufgaben",
          content: [
            { textKey: "Handbook.taskTypes.free.content.0", images: ["1", "2"] },
            { textKey: "Handbook.taskTypes.free.content.1", images: ["3"] },
          ],
        },
        {
          headingKey: "Handbook.taskTypes.info.heading",
          path: "assets/handbook/aufgabentypen/informationsblock",
          content: [
            { textKey: "Handbook.taskTypes.info.content.0", images: ["1"] },
          ],
        },
      ],
    },
    /* Virtual world */
    {
      titleKey: "Handbook.virtualWorld.sectionTitle",
      subsections: [
        {
          headingKey: "Handbook.virtualWorld.playGame.heading",
          path: "assets/handbook/vr_spiel_spielen",
          content: [
            { textKey: "Handbook.virtualWorld.playGame.content.0", images: ["1"] },
            { textKey: "Handbook.virtualWorld.playGame.content.1", images: ["2", "3"] },
            { textKey: "Handbook.virtualWorld.playGame.content.2", images: ["4"] },
          ],
        },
        {
          headingKey: "Handbook.virtualWorld.createGame.heading",
          path: "assets/handbook/vr_spiel_erstellen",
          content: [
            { textKey: "Handbook.virtualWorld.createGame.content.0", images: ["1"] },
            { textKey: "Handbook.virtualWorld.createGame.content.1", images: ["2", "3", "4"] },
            { textKey: "Handbook.virtualWorld.createGame.content.2", images: ["5"] },
            { textKey: "Handbook.virtualWorld.createGame.content.3", images: ["6"] },
          ],
        },
        {
          headingKey: "Handbook.virtualWorld.editGame.heading",
          path: "assets/handbook/vr_spiel_bearbeiten",
          content: [
            { textKey: "Handbook.virtualWorld.editGame.content.0", images: ["1"] },
            { textKey: "Handbook.virtualWorld.editGame.content.1", images: ["2"] },
            { textKey: "Handbook.virtualWorld.editGame.content.2", images: ["3"] },
            { textKey: "Handbook.virtualWorld.editGame.content.3", images: ["4"] },
          ],
        },
      ],
    },
    /* Task types VR */
    {
      titleKey: "Handbook.taskTypesVR.sectionTitle",
      subsections: [
        {
          headingKey: "Handbook.taskTypesVR.navigation.heading",
          path: "assets/handbook/vr_aufgabentypen/navigationsaufgaben",
          content: [
            { textKey: "Handbook.taskTypesVR.navigation.content.0", images: ["1"] },
            { textKey: "Handbook.taskTypesVR.navigation.content.1", images: ["2"] },
            { textKey: "Handbook.taskTypesVR.navigation.content.2", images: ["3"] },
          ],
        },
        {
          headingKey: "Handbook.taskTypesVR.orientation.heading",
          path: "assets/handbook/vr_aufgabentypen/orientierungsaufgaben",
          content: [
            { textKey: "Handbook.taskTypesVR.orientation.content.0", images: ["1"] },
            { textKey: "Handbook.taskTypesVR.orientation.content.1", images: ["2"] },
            { textKey: "Handbook.taskTypesVR.orientation.content.2", images: ["3"] },
          ],
        },
        {
          headingKey: "Handbook.taskTypesVR.free.heading",
          path: "assets/handbook/vr_aufgabentypen/freie_aufgaben",
          content: [
            { textKey: "Handbook.taskTypesVR.free.content.0", images: ["1", "2"] },
            { textKey: "Handbook.taskTypesVR.free.content.1", images: ["3"] },
          ],
        },
        {
          headingKey: "Handbook.taskTypesVR.info.heading",
          path: "assets/handbook/vr_aufgabentypen/informationsblock",
          content: [
            { textKey: "Handbook.taskTypesVR.info.content.0", images: ["1"] },
            { textKey: "Handbook.taskTypesVR.info.content.1", images: ["2"] },
          ],
        },
      ],
    },
    /* Map features */
    {
      titleKey: "Handbook.mapFeatures.sectionTitle",
      subsections: [
        {
          headingKey: "Handbook.mapFeatures.overview.heading",
          path: "assets/handbook/vr_aufgabentypen/navigationsaufgaben",
          content: [
            { textKey: "Handbook.mapFeatures.overview.content.0", images: ["no"] },
            { textKey: "Handbook.mapFeatures.overview.content.1", images: ["no"] },
            { textKey: "Handbook.mapFeatures.overview.content.2", images: ["no"] },
            { textKey: "Handbook.mapFeatures.overview.content.3", images: ["no"] },
            { textKey: "Handbook.mapFeatures.overview.content.4", images: ["no"] },
            { textKey: "Handbook.mapFeatures.overview.content.5", images: ["no"] },
            { textKey: "Handbook.mapFeatures.overview.content.6", images: ["no"] },
            { textKey: "Handbook.mapFeatures.overview.content.7", images: ["no"] },
          ],
        },
      ],
    },
    /* Further settings */
    {
      titleKey: "Handbook.furtherSettings.sectionTitle",
      subsections: [
        {
          headingKey: "Handbook.furtherSettings.settings.heading",
          path: "assets/handbook/weitere-einstellungen",
          content: [
            { textKey: "Handbook.furtherSettings.settings.content.0", images: ["1"] },
            { textKey: "Handbook.furtherSettings.settings.content.1", images: ["2"] },
            { textKey: "Handbook.furtherSettings.settings.content.2", images: ["3"] },
            { textKey: "Handbook.furtherSettings.settings.content.3", images: ["4"] },
            { textKey: "Handbook.furtherSettings.settings.content.4", images: ["5"] },
            { textKey: "Handbook.furtherSettings.settings.content.5", images: ["6"] },
            { textKey: "Handbook.furtherSettings.settings.content.6", images: ["7"] },
            { textKey: "Handbook.furtherSettings.settings.content.7", images: ["no"] },
          ],
        },
      ],
    },
  ];

  constructor(public languageService: LanguageService) {}

  ngOnInit() {}

  onLanguageChange(event: CustomEvent) {
    this.languageService.setLanguage(event.detail.value);
  }
}
