// TODO: you might want to remove this file from the project if it is not needed anymore
import { Component, OnInit, ElementRef } from "@angular/core";

import { NavController } from "@ionic/angular";

import { GamesService } from "../../../services/games.service";

import {
  Plugins,
  FilesystemDirectory,
  FilesystemEncoding,
} from "@capacitor/core";
import { environment } from "src/environments/environment";
import { HttpClient } from "@angular/common/http";
import { DomSanitizer } from "@angular/platform-browser"; //* for downloading a file
import { AuthService } from "src/app/services/auth-service.service";

@Component({
  selector: "app-analyze-game-list",
  templateUrl: "./analyze-game-list.page.html",
  styleUrls: ["./analyze-game-list.page.scss"],
})
export class AnalyzeGameListPage implements OnInit {
  tracks: any[] = [];
  gamesWithTracks: any[] = [];

  // to only allow logged-in users to see this page (the API scopes which tracks each caller sees)
  user = this.authService.getUser();
  userRole: string;

  blobUrl: any;
  sanitizedBlobUrl: any;
  filename: string;

  constructor(
    public navCtrl: NavController,
    private gamesService: GamesService,
    private http: HttpClient,
    private authService: AuthService
  ) {}

  async ngOnInit() {
    // this.gamesService.getTracks().then(tracks => {
    //   this.tracks = tracks
    // });

    //* old impl. (showing tracks stored locally)
    // await this.getTracks();
    //* new impl. (showing user games that has tracks)
    this.getUserGamesBasicData();
  }

  ionViewWillEnter() {
    // Check user role. Allow ["admin", "contentAdmin", "trackAccess", "scholar", "user"] to access evaluate page
    this.user.subscribe((event) => {
      if (
        event == null ||
        ![
          "admin",
          "contentAdmin",
          "trackAccess",
          "scholar",
          "user",
        ].includes(event["roles"][0])
      ) {
        this.navCtrl.navigateForward("/");
      }
    });
  }

  //* Get user games that has at least on track
  getUserGamesBasicData() {
    this.gamesService
      .getUserGamesWithTrackInfo()
      .then((res: any) => res.content)
      .then((games) => {
        console.log("🚀 ~ file: analyze-game-list.page.ts:70 ~ AnalyzeGameListPage ~ .then ~ games:", games)
        this.gamesWithTracks = games;
      });
  }

  async getTracks() {
    try {
      const ret = await Plugins.Filesystem.readdir({
        path: "origami/tracks",
        directory: FilesystemDirectory.Documents,
      });
      this.tracks = ret.files;
    } catch (e) {
      // console.error("Unable to read dir", e);
    }
  }
  //--- ToDo
  async upload(track) {
    const contents = await Plugins.Filesystem.readFile({
      path: `origami/tracks/${track}`,
      directory: FilesystemDirectory.Documents,
      encoding: FilesystemEncoding.UTF8,
    });
// console.log(contents);

    this.http
      .post(`${environment.apiURL}/track`, JSON.parse(contents.data), {
        observe: "response",
      })
      .subscribe((response) =>
        alert(response.status + " " + response.statusText)
      );
  }

  async remove(track) {
    this.confirmDialog(`Willst du die Datei ${track} wirklich löschen?`) // --- ToDo (translate)
      .then(async () => {
        await Plugins.Filesystem.deleteFile({
          path: `origami/tracks/${track}`,
          directory: FilesystemDirectory.Documents,
        });
      })
      .catch((err) => console.log("User aborted delete"))
      .finally(async () => await this.getTracks());
  }

  private confirmDialog(msg: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const confirmed = window.confirm(msg);

      return confirmed ? resolve(true) : reject(false);
    });
  }

  //* open game's tracks
  gameClick(game: any) {
    let bundle = {
      id: game._id,
      /* replace is used to get rid of special charachters, so values can be sent via routing */
      name: game.name.replace(/[&\/\\#,+()$~%.'":*?<>{}]/g, ""),
    };
    this.navCtrl.navigateForward(
      `analyze/game-tracks/${JSON.stringify(bundle)}`
    );
  }
}
