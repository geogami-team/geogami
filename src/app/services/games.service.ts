import { Injectable } from "@angular/core";

import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";

import { Game } from "./../models/game";

import { environment } from "../../environments/environment";

export type GameLookup =
  | { state: "found"; game: any }
  | { state: "notFound" }
  | { state: "error" };

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

  // For the public game reads: the token when signed in, nothing otherwise.
  // The server then returns the caller's own address in `editors` when they
  // co-author the game (other people's addresses are never sent), which
  // "My games" and the editor's Delete button rely on.
  private optionalAuthHeaders(): HttpHeaders {
    const token = window.localStorage.getItem("bg_accesstoken");
    return token
      ? new HttpHeaders({ Authorization: "Bearer " + token })
      : new HttpHeaders();
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
        }`,
        { headers: this.optionalAuthHeaders() }
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

  // ── Game co-authors (editors) ─────────────────────────────────────────
  // Current co-author emails of a game (owner/admin only).
  getGameEditors(id: string): Promise<any> {
    return this.http
      .get(`${environment.apiURL}/game/${id}/editors`, {
        headers: this.createHeaders(),
      })
      .toPromise();
  }

  // Add co-author(s) by email.
  addGameEditors(id: string, emails: string[]): Promise<any> {
    return this.http
      .post(
        `${environment.apiURL}/game/${id}/editors`,
        { emails },
        { headers: this.createHeaders(), observe: "response" }
      )
      .toPromise();
  }

  // Remove a co-author by email.
  removeGameEditors(id: string, emails: string[]): Promise<any> {
    return this.http
      .request("delete", `${environment.apiURL}/game/${id}/editors`, {
        body: { emails },
        headers: this.createHeaders(),
        observe: "response",
      })
      .toPromise();
  }

  // Who created a game and when (admin only). Fetched lazily when the
  // creator-info modal is opened — never as part of the list load.
  getGameCreatorInfo(id: string): Promise<any> {
    return this.http
      .get(`${environment.apiURL}/game/${id}/creator`, {
        headers: this.createHeaders(),
      })
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
      .get(`${environment.apiURL}/game/${id}`, {
        headers: this.optionalAuthHeaders(),
      })
      .toPromise()
      // in case game was deleted or not found
      .catch((err) => {
        console.log(err);
      });
  }

  /**
   * Looks up a game to play and says why it isn't there when it isn't.
   * - `notFound`: no game id, a malformed id, or the server has no visible game
   *   with it (deleted, hidden, or never existed). Retrying won't help.
   * - `error`: the request itself failed (offline, server down). Retrying may help.
   * Malformed ids are rejected here, so they never reach the API (older API
   * builds answer them with a 500 CastError instead of a 404).
   */
  async findGame(id: string): Promise<GameLookup> {
    if (!/^[0-9a-f]{24}$/i.test(id ?? "")) return { state: "notFound" };
    try {
      const res: any = await this.http
        .get(`${environment.apiURL}/game/${id}`)
        .toPromise();
      return res?.content
        ? { state: "found", game: res.content }
        : { state: "notFound" };
    } catch (err) {
      return err?.status === 404 ? { state: "notFound" } : { state: "error" };
    }
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
  // The server answers with the version of the given platform ("ios" or "android");
  // apps released before it was sent are told apart by their user agent.
  getAppVersion(platform: string): Promise<any> {
    return this.http
      .get(`${environment.apiURL}/appversion/current`, { params: { platform } })
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
