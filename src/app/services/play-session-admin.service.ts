import { HttpClient, HttpParams } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../environments/environment";
import {
  LivePlays,
  PlayHistoryFilters,
  PlayHistoryPage,
  parseLivePlays,
  parsePlayHistory,
} from "../models/play-session";
import { AuthService } from "./auth-service.service";

/**
 * Reads the recorded plays for the "Live plays" page (admin only). The app's own
 * messages about a play are sent by PlaySessionService.
 */
@Injectable({
  providedIn: "root",
})
export class PlaySessionAdminService {
  constructor(private http: HttpClient, private authService: AuthService) {}

  private get url(): string {
    return `${environment.apiURL}/play-session`;
  }

  async fetchLive(): Promise<LivePlays> {
    const raw = await this.http
      .get(`${this.url}/live`, { headers: this.authService.createHeaders() })
      .toPromise();
    const live = parseLivePlays(raw);
    if (!live) throw new Error("Unexpected live plays response");
    return live;
  }

  async fetchHistory(filters: PlayHistoryFilters, before?: string, limit = 50): Promise<PlayHistoryPage> {
    let params = new HttpParams().set("limit", String(limit));
    for (const [key, value] of Object.entries(filters)) {
      const text = typeof value === "string" ? value.trim() : "";
      if (text) params = params.set(key, text);
    }
    if (before) params = params.set("before", before);
    const raw = await this.http
      .get(this.url, { headers: this.authService.createHeaders(), params })
      .toPromise();
    const page = parsePlayHistory(raw);
    if (!page) throw new Error("Unexpected play history response");
    return page;
  }
}
