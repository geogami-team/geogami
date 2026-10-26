import { Component, OnInit } from "@angular/core";
import { AlertController } from "@ionic/angular";
import { TranslateService } from "@ngx-translate/core";
import {
  APP_VERSION_FIELDS,
  BUILD_PATTERN,
  VERSION_PATTERN,
  AppVersionFields,
  AppVersionSettings,
  PromptAudience,
  appVersionFieldsOf,
  isValidAppVersion,
  isValidBuild,
  promptAudience,
} from "src/app/models/app-version";
import { AppVersionService } from "src/app/services/app-version.service";
import { GamesService } from "src/app/services/games.service";
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

  /** Newest release on GitHub, as a hint for the version field (best effort). */
  githubLatest = "";

  // The inputs validate with the same rules, so Ionic marks them invalid and shows their error text.
  readonly versionPattern = VERSION_PATTERN;
  readonly buildPattern = BUILD_PATTERN;

  constructor(
    private appVersion: AppVersionService,
    private gamesService: GamesService,
    private alertController: AlertController,
    private translate: TranslateService,
    private utilService: UtilService
  ) {}

  ngOnInit() {
    this.load();
    this.gamesService
      .getGithubLatestVersion()
      .then((res) => (this.githubLatest = (res && res.content && res.content.version) || ""))
      .catch(() => {
        /* only a hint */
      });
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

  /** Makes settings read from the server the new base of the draft. */
  private adopt(settings: AppVersionSettings) {
    this.saved = settings;
    this.draft = appVersionFieldsOf(settings);
    this.conflict = false;
  }

  // ── Draft ────────────────────────────────────────────────────────────────

  get versionValid(): boolean {
    return !!this.draft && isValidAppVersion(this.draft.version);
  }

  get buildValid(): boolean {
    return !!this.draft && isValidBuild(this.draft.build);
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
    return !!this.saved && this.dirty && this.versionValid && this.buildValid && !this.saving;
  }

  get audience(): PromptAudience {
    return this.draft ? promptAudience(this.draft) : "none";
  }

  /** One sentence on which devices the draft asks to update. */
  get audienceText(): string {
    if (this.audience !== "none" && !this.versionValid) {
      return this.translate.instant("AppVersion.audienceNeedsVersion");
    }
    const key = {
      none: "AppVersion.audienceNone",
      ios: "AppVersion.audienceIos",
      android: "AppVersion.audienceAndroid",
      both: "AppVersion.audienceBoth",
    }[this.audience];
    return this.translate.instant(key, { version: this.draft ? this.draft.version : "" });
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
    this.saving = true;
    try {
      this.adopt(await this.appVersion.saveSettings(this.saved.revision, appVersionFieldsOf(this.draft)));
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
      message: this.translate.instant("AppVersion.confirmMajorMessage", {
        audience: this.audienceText,
        version: this.draft.version,
      }),
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
