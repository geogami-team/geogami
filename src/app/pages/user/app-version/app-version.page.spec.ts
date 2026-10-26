import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormsModule } from "@angular/forms";
import { RouterTestingModule } from "@angular/router/testing";
import { AlertController, IonicModule } from "@ionic/angular";
import { TranslateModule } from "@ngx-translate/core";
import {
  APP_VERSION_MANAGER_ROLES,
  AppVersionSettings,
  isValidAppVersion,
  isValidBuild,
  parseAppVersionSettings,
  promptAudience,
} from "../../../models/app-version";
import { AppVersionService } from "../../../services/app-version.service";
import { GamesService } from "../../../services/games.service";
import { UtilService } from "../../../services/util.service";
import { AppVersionPage } from "./app-version.page";

describe("AppVersionPage", () => {
  let fixture: ComponentFixture<AppVersionPage>;
  let page: AppVersionPage;
  let service: { fetchSettings: jasmine.Spy; saveSettings: jasmine.Spy };
  let games: { getGithubLatestVersion: jasmine.Spy };
  let util: { showToast: jasmine.Spy; showValidationError: jasmine.Spy };
  let alerts: { create: jasmine.Spy };
  let confirmRole: string;

  const settings = (revision: number, extra: Partial<AppVersionSettings> = {}): AppVersionSettings => ({
    revision,
    enabled: true,
    ios: true,
    android: true,
    version: "6.1.0",
    major: false,
    build: "12",
    updatedAt: revision ? "2026-10-16T10:00:00.000Z" : null,
    updatedBy: revision ? "an-admin" : null,
    ...extra,
  });
  const text = () => (fixture.nativeElement.textContent || "").replace(/\s+/g, " ");
  const settle = async () => {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  };
  // Ionic copies the form state onto the item in the next animation frame.
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const itemClasses = async (id: string) => {
    await settle();
    await frame();
    return fixture.nativeElement.querySelector(`#app-version-${id}`).classList as DOMTokenList;
  };

  async function open(first: AppVersionSettings | Promise<AppVersionSettings>) {
    service.fetchSettings.and.returnValue(Promise.resolve(first));
    fixture = TestBed.createComponent(AppVersionPage);
    page = fixture.componentInstance;
    await settle();
  }

  beforeEach(() => {
    service = { fetchSettings: jasmine.createSpy("fetchSettings"), saveSettings: jasmine.createSpy("saveSettings") };
    games = {
      getGithubLatestVersion: jasmine
        .createSpy("github")
        .and.returnValue(Promise.resolve({ content: { version: "6.2.0" } })),
    };
    util = { showToast: jasmine.createSpy("toast"), showValidationError: jasmine.createSpy("validation") };
    confirmRole = "confirm";
    alerts = {
      create: jasmine.createSpy("create").and.callFake(async () => ({
        present: jasmine.createSpy("present").and.returnValue(Promise.resolve()),
        onDidDismiss: () => Promise.resolve({ role: confirmRole }),
      })),
    };
    TestBed.configureTestingModule({
      declarations: [AppVersionPage],
      imports: [IonicModule.forRoot(), FormsModule, TranslateModule.forRoot(), RouterTestingModule],
      providers: [
        { provide: AppVersionService, useValue: service },
        { provide: GamesService, useValue: games },
        { provide: UtilService, useValue: util },
        { provide: AlertController, useValue: alerts },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
  });

  describe("loading", () => {
    it("shows the stored settings as a form, in one centred column", async () => {
      await open(settings(0));
      expect(page.draft).toEqual({ enabled: true, ios: true, android: true, version: "6.1.0", major: false, build: "12" });
      for (const id of ["enabled", "ios", "android", "version", "major", "build"]) {
        expect(fixture.nativeElement.querySelector(`ion-content > .page-column #app-version-${id}`)).not.toBeNull();
      }
      expect(fixture.nativeElement.querySelector("ion-footer .page-column")).not.toBeNull();
      expect(text()).toContain("AppVersion.notSavedYet");
    });

    it("names the last save and who made it", async () => {
      await open(settings(3));
      expect(text()).toContain("AppVersion.lastSaved");
      expect(text()).toContain("AppVersion.lastSavedBy");
    });

    it("offers the newest GitHub release as a hint", async () => {
      await open(settings(0));
      expect(page.githubLatest).toBe("6.2.0");
      expect(text()).toContain("AppVersion.githubLatest");
    });

    it("carries on without the hint when GitHub cannot be reached", async () => {
      games.getGithubLatestVersion.and.returnValue(Promise.reject(new Error("offline")));
      await open(settings(0));
      expect(page.githubLatest).toBe("");
      expect(text()).not.toContain("AppVersion.githubLatest");
    });

    it("says the settings could not be loaded instead of showing a form, and can try again", async () => {
      service.fetchSettings.and.returnValue(Promise.reject(new Error("offline")));
      fixture = TestBed.createComponent(AppVersionPage);
      page = fixture.componentInstance;
      await settle();
      expect(text()).toContain("AppVersion.loadFailed");
      expect(page.draft).toBeNull();
      expect(page.canSave).toBe(false);
      expect(fixture.nativeElement.querySelector("ion-footer")).toBeNull();

      service.fetchSettings.and.returnValue(Promise.resolve(settings(1)));
      await page.load();
      await settle();
      expect(page.loadError).toBe(false);
      expect(fixture.nativeElement.querySelector("#app-version-version")).not.toBeNull();
    });
  });

  describe("editing", () => {
    it("starts clean and can only be saved after a change", async () => {
      await open(settings(1));
      expect(page.dirty).toBe(false);
      expect(page.canSave).toBe(false);
      page.draft.version = "6.2.0";
      expect(page.dirty).toBe(true);
      expect(page.canSave).toBe(true);
    });

    it("refuses an invalid version or build number, and marks the field so its error text shows", async () => {
      await open(settings(1));
      expect(await itemClasses("version")).toContain("ion-valid");
      page.draft.version = "6.2";
      expect(page.canSave).toBe(false);
      expect(await itemClasses("version")).toContain("ion-invalid");
      page.draft.version = "";
      expect(await itemClasses("version")).toContain("ion-invalid");

      page.draft.version = "6.2.0";
      page.draft.build = "12b";
      expect(page.canSave).toBe(false);
      expect(await itemClasses("version")).toContain("ion-valid");
      expect(await itemClasses("build")).toContain("ion-invalid");
      page.draft.build = "";
      expect(await itemClasses("build")).toContain("ion-valid");
      expect(page.canSave).toBe(true);
    });

    it("marks a stored version the apps cannot compare as soon as the page opens", async () => {
      await open(settings(0, { version: "v6.1" }));
      expect(await itemClasses("version")).toContain("ion-invalid");
      expect(page.versionValid).toBe(false);
    });

    it("can throw the changes away", async () => {
      await open(settings(1));
      page.draft.major = true;
      page.discard();
      expect(page.draft.major).toBe(false);
      expect(page.dirty).toBe(false);
    });

    it("says which devices are asked to update", async () => {
      await open(settings(1));
      expect(page.audience).toBe("both");
      expect(text()).toContain("AppVersion.audienceBoth");
      expect(text()).toContain("Start.appUpdateHeader");
      expect(text()).toContain("Start.notNow");

      page.draft.major = true;
      await settle();
      expect(text()).toContain("Start.majorAppUpdateHeader");
      expect(text()).not.toContain("Start.notNow");

      page.draft.enabled = false;
      await settle();
      expect(text()).toContain("AppVersion.audienceNone");
      expect(text()).not.toContain("Start.update");
    });

    it("does not describe a prompt for a version the apps cannot compare", async () => {
      await open(settings(1));
      page.draft.version = "6.2";
      await settle();
      expect(text()).toContain("AppVersion.audienceNeedsVersion");
      expect(text()).not.toContain("AppVersion.audienceBoth");
      expect(text()).not.toContain("Start.update");
    });
  });

  describe("saving", () => {
    it("sends every field with the revision it loaded and shows the saved result", async () => {
      await open(settings(1));
      service.saveSettings.and.returnValue(Promise.resolve(settings(2, { version: "6.2.0" })));
      page.draft.version = "6.2.0";
      await page.save();
      expect(service.saveSettings).toHaveBeenCalledWith(1, {
        enabled: true,
        ios: true,
        android: true,
        version: "6.2.0",
        major: false,
        build: "12",
      });
      expect(page.saved.revision).toBe(2);
      expect(page.dirty).toBe(false);
      expect(util.showToast).toHaveBeenCalledWith("AppVersion.saved", "success");
      expect(alerts.create).not.toHaveBeenCalled();
    });

    it("asks for confirmation before requiring an update, and saves nothing when cancelled", async () => {
      await open(settings(1));
      page.draft.major = true;
      confirmRole = "cancel";
      await page.save();
      expect(alerts.create).toHaveBeenCalledTimes(1);
      expect(service.saveSettings).not.toHaveBeenCalled();
      expect(page.draft.major).toBe(true);

      confirmRole = "confirm";
      service.saveSettings.and.returnValue(Promise.resolve(settings(2, { major: true })));
      await page.save();
      expect(service.saveSettings).toHaveBeenCalledTimes(1);
    });

    it("does not ask when the prompt is off", async () => {
      await open(settings(1, { enabled: false }));
      page.draft.major = true;
      service.saveSettings.and.returnValue(Promise.resolve(settings(2, { enabled: false, major: true })));
      await page.save();
      expect(alerts.create).not.toHaveBeenCalled();
      expect(service.saveSettings).toHaveBeenCalled();
    });

    it("keeps the draft and reports the failure when saving fails", async () => {
      await open(settings(1));
      service.saveSettings.and.returnValue(Promise.reject({ status: 500 }));
      page.draft.version = "6.2.0";
      await page.save();
      expect(page.draft.version).toBe("6.2.0");
      expect(page.saved.version).toBe("6.1.0");
      expect(util.showValidationError).toHaveBeenCalledWith("AppVersion.saveFailed");
      expect(util.showToast).not.toHaveBeenCalled();
    });

    it("after a conflict, reloads and puts the admin's own changes back on top", async () => {
      await open(settings(1));
      service.saveSettings.and.returnValue(Promise.reject({ status: 409 }));
      page.draft.version = "6.2.0";
      await page.save();
      await settle();
      expect(page.conflict).toBe(true);
      expect(text()).toContain("AppVersion.conflictText");

      // Someone else switched Android off meanwhile.
      service.fetchSettings.and.returnValue(Promise.resolve(settings(2, { android: false })));
      await page.reloadAfterConflict();
      expect(page.conflict).toBe(false);
      expect(page.saved.revision).toBe(2);
      expect(page.draft.version).toBe("6.2.0");
      expect(page.draft.android).toBe(false);
    });
  });
});

describe("app version model", () => {
  it("is for administrators only", () => {
    expect(APP_VERSION_MANAGER_ROLES).toEqual(["admin"]);
  });

  it("accepts the versions the apps can compare, and nothing else", () => {
    for (const ok of ["6.2.0", "0.0.1", "10.999.0"]) {
      expect(isValidAppVersion(ok)).withContext(ok).toBe(true);
    }
    for (const bad of ["", "6.2", "6.2.0.1", "v6.2.0", "6.02.0", "6.1000.0", " 6.2.0"]) {
      expect(isValidAppVersion(bad)).withContext(bad).toBe(false);
    }
    expect(isValidBuild("")).toBe(true);
    expect(isValidBuild("123")).toBe(true);
    expect(isValidBuild("12a")).toBe(false);
  });

  it("reads a server answer, and rejects one without a revision", () => {
    expect(parseAppVersionSettings({ revision: 0, version: "6.1.0", enabled: true })).toEqual({
      revision: 0,
      enabled: true,
      ios: false,
      android: false,
      version: "6.1.0",
      major: false,
      build: "",
      updatedAt: null,
      updatedBy: null,
    });
    expect(parseAppVersionSettings(null)).toBeNull();
    expect(parseAppVersionSettings({ version: "6.1.0" })).toBeNull();
  });

  it("works out which devices are asked to update", () => {
    const base = { enabled: true, ios: true, android: true, version: "6.2.0", major: false, build: "" };
    expect(promptAudience(base)).toBe("both");
    expect(promptAudience({ ...base, android: false })).toBe("ios");
    expect(promptAudience({ ...base, ios: false })).toBe("android");
    expect(promptAudience({ ...base, ios: false, android: false })).toBe("none");
    expect(promptAudience({ ...base, enabled: false })).toBe("none");
  });
});
