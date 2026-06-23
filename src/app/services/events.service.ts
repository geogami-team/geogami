import { Injectable } from "@angular/core";
import { HttpClient, HttpHeaders } from "@angular/common/http";

import { GeoEvent } from "../models/event";
import { environment } from "../../environments/environment";

/**
 * Client for the /event API. Auth uses the same bearer-token-from-localStorage
 * scheme as GamesService.
 */
@Injectable({
  providedIn: "root",
})
export class EventsService {
  constructor(private http: HttpClient) {}

  private createHeaders() {
    let headers = new HttpHeaders();
    const token = window.localStorage.getItem("bg_accesstoken");
    if (token) {
      headers = headers.append("Authorization", "Bearer " + token);
    }
    headers = headers.append("Content-Type", "application/json");
    return headers;
  }

  // Events the caller owns or that are shared with them.
  getUserEvents(): Promise<any> {
    return this.http
      .get(`${environment.apiURL}/event/userevents`, {
        headers: this.createHeaders(),
      })
      .toPromise();
  }

  createEvent(event: GeoEvent): Promise<any> {
    return this.http
      .post(`${environment.apiURL}/event`, this.toPayload(event), {
        headers: this.createHeaders(),
        observe: "response",
      })
      .toPromise();
  }

  updateEvent(event: GeoEvent): Promise<any> {
    return this.http
      .put(
        `${environment.apiURL}/event`,
        { _id: event._id, ...this.toPayload(event) },
        { headers: this.createHeaders(), observe: "response" }
      )
      .toPromise();
  }

  deleteEvent(id: string): Promise<any> {
    return this.http
      .delete(`${environment.apiURL}/event/${id}`, {
        headers: this.createHeaders(),
        observe: "response",
      })
      .toPromise();
  }

  // ── Sharing (owner-only on the server) ────────────────────────────────
  getEventSharedWith(id: string): Promise<any> {
    return this.http
      .get(`${environment.apiURL}/event/${id}/share`, {
        headers: this.createHeaders(),
      })
      .toPromise();
  }

  shareEvent(id: string, emails: string[]): Promise<any> {
    return this.http
      .post(
        `${environment.apiURL}/event/${id}/share`,
        { emails },
        { headers: this.createHeaders() }
      )
      .toPromise();
  }

  unshareEvent(id: string, emails: string[]): Promise<any> {
    return this.http
      .request("delete", `${environment.apiURL}/event/${id}/share`, {
        body: { emails },
        headers: this.createHeaders(),
      })
      .toPromise();
  }

  // Normalise an event into the fields the server accepts, reducing `games` to
  // a plain array of ids whether they arrived as ids or populated objects.
  private toPayload(event: GeoEvent) {
    return {
      name: event.name,
      description: event.description,
      games: (event.games || []).map((g) =>
        typeof g === "string" ? g : g._id
      ),
    };
  }
}
