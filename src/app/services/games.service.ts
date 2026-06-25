import { Injectable } from "@angular/core";

import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

import { Game } from "./../models/game";

import { environment } from "../../environments/environment";

@Injectable({
  providedIn: "root",
})
export class GamesService {
  constructor(private http: HttpClient) {}

  createHeaders() {
    let headers = new HttpHeaders();
    const token = window.localStorage.getItem("bg_accesstoken");
    if (token) {
      // The token is valid for one hour
      // and is stored in localStorage after login
      headers = headers.append("Authorization", "Bearer " + token);
    }
    headers = headers.append("Content-Type", "application/json");
    return headers;
  }

  getGames(
    minimal: boolean = false,
    registeredUser: boolean = false
  ): Promise<any> {
    // Only content admin can view multi-players games
    return this.http
      .get(
        `${environment.apiURL}/game/all/?${minimal ? "minimal" : ""}&${
          registeredUser ? "registeredUser" : ""
        }`
      )
      .toPromise();
  }

  getMinimalGamesWithLocs(): Promise<any> {
    return this.http.get(`${environment.apiURL}/game/allwithlocs`).toPromise();
  }

  // Draft (unpublished) games visible to the caller: admin/contentAdmin get all
  // drafts, any other user gets only their own. Requires auth.
  getDraftGames(): Promise<any> {
    return this.http
      .get(`${environment.apiURL}/game/drafts`, {
        headers: this.createHeaders(),
      })
      .toPromise();
  }

  // Publish / unpublish a single game (creator or admin/contentAdmin).
  setPublishState(id: string, isPublished: boolean): Promise<any> {
    return this.http
      .put(
        `${environment.apiURL}/game/${id}/publish`,
        { isPublished },
        { headers: this.createHeaders(), observe: "response" }
      )
      .toPromise();
  }

  getTracks(): Promise<any> {
    return this.http
      .get(`${environment.apiURL}/tracks`, {
        headers: this.createHeaders(),
      })
      .toPromise();
  }

  getGame(id: string): Promise<any> {
    return this.http
      .get(`${environment.apiURL}/game/${id}`)
      .toPromise()
      // in case game was deleted or not found
      .catch((err) => {
        console.log(err);
      });
  }

  postGame(game: Game): Promise<any> {
// console.log("///Game to be posted: ", game);
    delete game._id;
  // console.log("///Game to be posted without id: ", game);
    game.tasks.forEach((task) => delete task._id);
    return this.http
      .post(`${environment.apiURL}/game`, game, {
        headers: this.createHeaders(),
        observe: "response",
      })
      .toPromise();
  }

  updateGame(game: Game): Promise<any> {
    game.tasks.forEach((task) => {
      if (task._id.length != 24) delete task._id; //?????
    });
    return this.http
      .put(`${environment.apiURL}/game`, game, {
        headers: this.createHeaders(),
        observe: "response",
      })
      .toPromise();
  }

  deleteGame(id: string): Promise<any> {
    return this.http
      .put(`${environment.apiURL}/game/delete/${id}`,null, {
        headers: this.createHeaders(),
        observe: "response",
      })
      .toPromise();
  }

  getUserGames(): Promise<any> {
    return this.http
      .get(`${environment.apiURL}/user/games`, {
        headers: this.createHeaders(),
      })
      .toPromise();
  }

  // To retreive updated app version
  getAppVersion(): Promise<any> {
    return this.http
      .get(`${environment.apiURL}/appversion/current`)
      .toPromise();
  }

  // To retreive the latest GitHub release version (used by the web build)
  getGithubLatestVersion(): Promise<any> {
    return this.http
      .get(`${environment.apiURL}/appversion/github-latest`)
      .toPromise();
  }

  //* To retreive user games info that has at least on track
  getUserGamesWithTrackInfo() {
    return this.http
      .get(`${environment.apiURL}/game/usergames`, {
        headers: this.createHeaders(),
      })
      .toPromise();
  }

  /* uploadTrack(data): Promise<any> {
    return this.http
    .post(`${environment.apiURL}/track`, data, {
      headers: this.createHeaders(),
      observe: 'response',
    }
    ).toPromise();
  } */
}
