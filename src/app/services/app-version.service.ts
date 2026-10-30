import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { environment } from "../../environments/environment";
import {
  AppVersionFields,
  AppVersionSettings,
  StoreReleases,
  parseAppVersionSettings,
  parseStoreReleases,
} from "../models/app-version";
import { AuthService } from "./auth-service.service";

/**
 * Reads and saves the settings of the native apps' update prompt (admin only).
 * The apps themselves read the public GET /appversion/current (GamesService).
 */
@Injectable({
  providedIn: "root",
})
export class AppVersionService {
  constructor(private http: HttpClient, private authService: AuthService) {}

  private get url(): string {
    return `${environment.apiURL}/appversion`;
  }

  async fetchSettings(): Promise<AppVersionSettings> {
    const raw = await this.http
      .get(this.url, { headers: this.authService.createHeaders() })
      .toPromise();
    return this.accept(raw);
  }

  /**
   * Saves every field. `expectedRevision` is the revision the caller loaded; a newer
   * one on the server rejects with HTTP 409 (the body carries the current settings).
   */
  async saveSettings(expectedRevision: number, fields: AppVersionFields): Promise<AppVersionSettings> {
    const raw = await this.http
      .put(this.url, { expectedRevision, ...fields }, { headers: this.authService.createHeaders() })
      .toPromise();
    return this.accept(raw);
  }

  /** The newest release in the App Store and on Google Play, as the server read them. */
  async fetchStoreReleases(): Promise<StoreReleases> {
    const raw = await this.http
      .get(`${this.url}/stores`, { headers: this.authService.createHeaders() })
      .toPromise();
    return parseStoreReleases(raw);
  }

  private accept(raw: unknown): AppVersionSettings {
    const settings = parseAppVersionSettings(raw);
    if (!settings) {
      throw new Error("Unexpected app version response");
    }
    return settings;
  }
}
