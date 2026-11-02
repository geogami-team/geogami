import { Component, OnInit } from "@angular/core";
import { AlertController } from "@ionic/angular";
import { TranslateService } from "@ngx-translate/core";
import {
  APP_VERSION_FIELDS,
  STORE_FLAG,
  VERSION_FIELD,
  VERSION_PATTERN,
  AppVersionFields,
  AppVersionSettings,
  Platform,
  PromptAudience,
  StoreReleases,
  appVersionFieldsOf,
  isValidAppVersion,
  promptAudience,
} from "src/app/models/app-version";
import { AppVersionService } from "src/app/services/app-version.service";
import { UtilService } from "src/app/services/util.service";

/**
 * "App updates": where an admin sets the prompt that asks iOS and Android users to
 * update the app (until now this was edited by hand in the database).
 *
 * Like the Editor visibility page, the page edits a local draft that reaches the
 * server only on Save. The saved settings are always the ones read from the server —
 * if they cannot be loaded the page says so and nothing can be saved.
 */
@Component({
  selector: "app-app-version",
  templateUrl: "./app-version.page.html",
  styleUrls: ["./app-version.page.scss"],
})
export class AppVersionPage implements OnInit {
  loading = true;
  loadError = false;

  /** The settings as last read from the server (the base of the draft). */
  saved: AppVersionSettings | null = null;
  draft: AppVersionFields | null = null;

  saving = false;
  /** Someone else saved while this draft was open; the draft is kept. */
  conflict = false;

  /** Newest release in each store, as the server read it (best effort; null while unknown). */
  stores: StoreReleases = { ios: null, android: null };
  /** The stores were asked, so a missing release means a store could not be reached. */
  storesChecked = false;

  // The version fields validate with the same rule as the server.
  readonly versionPattern = VERSION_PATTERN;

  // Each platform has its own switches and version: one column per platform.
  readonly platforms: ReadonlyArray<Platform> = ["ios", "android"];
  readonly versionField = VERSION_FIELD;
  readonly storeFlag = STORE_FLAG;
  /** What differs per platform (brand names, so not translated). */
  readonly platformInfo: Readonly<Record<Platform, { name: string; store: string; icon: string }>> = {
    ios: { name: "iOS", store: "App Store", icon: "logo-apple" },
    android: { name: "Android", store: "Google Play", icon: "logo-android" },
  };

  constructor(
    private appVersion: AppVersionService,
    private alertController: AlertController,
    private translate: TranslateService,
    private utilService: UtilService
  ) {}

  ngOnInit() {
    this.load();
    this.loadStores();
  }

  async load() {
    this.loading = true;
    this.loadError = false;
    try {
      this.adopt(await this.appVersion.fetchSettings());
    } catch (error) {
      this.loadError = true;
    } finally {
      this.loading = false;
    }
  }

  async loadStores() {
    try {
      this.stores = await this.appVersion.fetchStoreReleases();
    } catch (error) {
      // Each store then shows as "cannot be reached".
    } finally {
      this.storesChecked = true;
    }
  }

  /** Makes settings read from the server the new base of the draft. */
  private adopt(settings: AppVersionSettings) {
    this.saved = settings;
    this.draft = appVersionFieldsOf(settings);
    this.conflict = false;
  }

  // ── Draft ────────────────────────────────────────────────────────────────

  /**
   * The version devices of a platform are compared with: while following its store,
   * the store's newest release (once known), otherwise the version typed in.
   */
  promptVersion(platform: Platform): string {
    if (!this.draft) {
      return "";
    }
    const release = this.stores[platform];
    return this.draft[STORE_FLAG[platform]] && release ? release.version : this.draft[VERSION_FIELD[platform]];
  }

  versionValid(platform: Platform): boolean {
    return isValidAppVersion(this.promptVersion(platform));
  }

  private get changedFields(): Array<keyof AppVersionFields> {
    if (!this.saved || !this.draft) {
      return [];
    }
    return APP_VERSION_FIELDS.filter((field) => this.draft[field] !== this.saved[field]);
  }

  get dirty(): boolean {
    return this.changedFields.length > 0;
  }

  get canSave(): boolean {
    return (
      !!this.saved &&
      this.dirty &&
      this.platforms.every((platform) => this.versionValid(platform)) &&
      !this.saving
    );
  }

  get audience(): PromptAudience {
    return this.draft ? promptAudience(this.draft) : "none";
  }

  /** Every platform the draft asks to update has a version the apps can compare. */
  get askedVersionsValid(): boolean {
    return this.platforms
      .filter((platform) => this.audience === "both" || this.audience === platform)
      .every((platform) => this.versionValid(platform));
  }

  /** One sentence on which devices the draft asks to update. */
  get audienceText(): string {
    if (!this.askedVersionsValid) {
      return this.translate.instant("AppVersion.audienceNeedsVersion");
    }
    const key = {
      none: "AppVersion.audienceNone",
      ios: "AppVersion.audienceIos",
      android: "AppVersion.audienceAndroid",
      both: "AppVersion.audienceBoth",
    }[this.audience];
    return this.translate.instant(key, { ios: this.promptVersion("ios"), android: this.promptVersion("android") });
  }

  /** Following a store takes over its newest version, which is also kept as the fallback. */
  setFollowStore(platform: Platform, on: boolean) {
    this.draft[STORE_FLAG[platform]] = on;
    const release = this.stores[platform];
    if (on && release) {
      this.draft[VERSION_FIELD[platform]] = release.version;
    }
  }

  discard() {
    if (this.saved) {
      this.draft = appVersionFieldsOf(this.saved);
    }
  }

  // ── Saving ───────────────────────────────────────────────────────────────

  async save() {
    if (!this.canSave) {
      return;
    }
    // A required update locks out every device below the version until it is
    // updated, so it is confirmed first.
    if (this.draft.major && this.audience !== "none" && !(await this.confirmRequiredUpdate())) {
      return;
    }
    // While following a store, the stored version (the fallback) is brought up to date.
    const fields = {
      ...appVersionFieldsOf(this.draft),
      version: this.promptVersion("ios"),
      androidVersion: this.promptVersion("android"),
    };
    this.saving = true;
    try {
      this.adopt(await this.appVersion.saveSettings(this.saved.revision, fields));
      this.utilService.showToast(this.translate.instant("AppVersion.saved"), "success");
    } catch (error) {
      // The draft stays exactly as it is, and nothing is reported as saved.
      if (error && error.status === 409) {
        this.conflict = true;
        this.utilService.showValidationError(this.translate.instant("AppVersion.conflictToast"));
      } else {
        this.utilService.showValidationError(this.translate.instant("AppVersion.saveFailed"));
      }
    } finally {
      this.saving = false;
    }
  }

  private async confirmRequiredUpdate(): Promise<boolean> {
    const alert = await this.alertController.create({
      header: this.translate.instant("AppVersion.confirmMajorHeader"),
      message: this.translate.instant("AppVersion.confirmMajorMessage", { audience: this.audienceText }),
      buttons: [
        { text: this.translate.instant("AppVersion.cancel"), role: "cancel" },
        { text: this.translate.instant("AppVersion.save"), role: "confirm" },
      ],
    });
    await alert.present();
    const { role } = await alert.onDidDismiss();
    return role === "confirm";
  }

  /**
   * After a conflict: load what is on the server now and re-apply this draft's own
   * changes on top of it, so nothing the admin edited is lost.
   */
  async reloadAfterConflict() {
    const mine = this.changedFields.map((field) => ({ field, value: this.draft[field] }));
    try {
      this.adopt(await this.appVersion.fetchSettings());
      for (const change of mine) {
        (this.draft as any)[change.field] = change.value;
      }
      this.utilService.showToast(this.translate.instant("AppVersion.reloaded"), "dark");
    } catch (error) {
      this.utilService.showValidationError(this.translate.instant("AppVersion.loadFailed"));
    }
  }
}
