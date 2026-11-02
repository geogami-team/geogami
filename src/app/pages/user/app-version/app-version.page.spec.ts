import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormsModule } from "@angular/forms";
import { RouterTestingModule } from "@angular/router/testing";
import { AlertController, IonicModule } from "@ionic/angular";
import { TranslateModule, TranslateService } from "@ngx-translate/core";
import {
  APP_VERSION_MANAGER_ROLES,
  AppVersionSettings,
  isValidAppVersion,
  parseAppVersionSettings,
  parseStoreRelease,
  parseStoreReleases,
  promptAudience,
} from "../../../models/app-version";
import { AppVersionService } from "../../../services/app-version.service";
import { UtilService } from "../../../services/util.service";
import { AppVersionPage } from "./app-version.page";

describe("AppVersionPage", () => {
  let fixture: ComponentFixture<AppVersionPage>;
  let page: AppVersionPage;
  let service: { fetchSettings: jasmine.Spy; saveSettings: jasmine.Spy; fetchStoreReleases: jasmine.Spy };
  let util: { showToast: jasmine.Spy; showValidationError: jasmine.Spy };
  let alerts: { create: jasmine.Spy };
  let confirmRole: string;

  const settings = (revision: number, extra: Partial<AppVersionSettings> = {}): AppVersionSettings => ({
    revision,
    enabled: true,
    ios: true,
    android: true,
    version: "6.1.0",
    androidVersion: "4.3.2",
    major: false,
    followAppStore: false,
    followPlayStore: false,
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
  // A field marked invalid for assistive technology, with its error text shown.
  const invalid = async (id: string) => {
    await settle();
    const input = fixture.nativeElement.querySelector(`#app-version-${id}`) as HTMLInputElement;
    const error = fixture.nativeElement.querySelector(`#${input.getAttribute("aria-describedby")}`);
    expect(!!error).withContext(`${id}: error text shown`).toBe(input.getAttribute("aria-invalid") === "true");
    return input.getAttribute("aria-invalid") === "true";
  };

  async function open(first: AppVersionSettings | Promise<AppVersionSettings>) {
    service.fetchSettings.and.returnValue(Promise.resolve(first));
    fixture = TestBed.createComponent(AppVersionPage);
    page = fixture.componentInstance;
    await settle();
  }

  const STORES = {
    ios: {
      version: "7.3.0",
      releasedAt: "2026-10-30T13:50:02Z",
      storeUrl: "https://apps.apple.com/us/app/geogami/id1614864078",
    },
    android: {
      version: "4.4.0",
      releasedAt: null,
      storeUrl: "https://play.google.com/store/apps/details?id=com.ifgi.geogami",
    },
  };
  const element = (id: string) => fixture.nativeElement.querySelector(`#app-version-${id}`);

  beforeEach(() => {
    service = {
      fetchSettings: jasmine.createSpy("fetchSettings"),
      saveSettings: jasmine.createSpy("saveSettings"),
      fetchStoreReleases: jasmine.createSpy("stores").and.returnValue(Promise.resolve(STORES)),
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
        { provide: UtilService, useValue: util },
        { provide: AlertController, useValue: alerts },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
  });

  describe("loading", () => {
    it("shows the stored settings as a form, in one centred column", async () => {
      await open(settings(0));
      expect(page.draft).toEqual({
        enabled: true,
        ios: true,
        android: true,
        version: "6.1.0",
        androidVersion: "4.3.2",
        major: false,
        followAppStore: false,
        followPlayStore: false,
      });
      for (const id of ["enabled", "major"]) {
        expect(fixture.nativeElement.querySelector(`ion-content > .page-column .settings #app-version-${id}`)).not.toBeNull();
      }
      // One column per platform, one row per setting.
      const headers = [...fixture.nativeElement.querySelectorAll(".platform-table thead th")];
      expect(headers.map((th: HTMLElement) => th.textContent.trim())).toEqual(["AppVersion.settingColumn", "iOS", "Android"]);
      expect(fixture.nativeElement.querySelectorAll(".platform-table tbody tr").length).toBe(4);
      for (const p of ["ios", "android"]) {
        for (const id of [p, `${p}-follow`, `${p}-version`, `${p}-in-store`]) {
          expect(fixture.nativeElement.querySelector(`.platform-table #app-version-${id}`)).withContext(id).not.toBeNull();
        }
      }
      expect(fixture.nativeElement.querySelector("ion-footer .page-column")).not.toBeNull();
      expect(text()).toContain("AppVersion.notSavedYet");
    });

    it("names the last save and who made it", async () => {
      await open(settings(3));
      expect(text()).toContain("AppVersion.lastSaved");
      expect(text()).toContain("AppVersion.lastSavedBy");
    });

    it("shows what is in each store now, with a link to the store page", async () => {
      await open(settings(0));
      expect(page.stores).toEqual(STORES);
      expect(element("ios-in-store").textContent).toContain("7.3.0");
      expect(element("ios-in-store").textContent).toContain("AppVersion.storeReleased");
      expect(element("ios-in-store").querySelector("a").getAttribute("href")).toBe(STORES.ios.storeUrl);
      expect(element("android-in-store").textContent).toContain("4.4.0");
      // Google Play gives no release date.
      expect(element("android-in-store").textContent).not.toContain("AppVersion.storeReleased");
      expect(element("android-in-store").querySelector("a").getAttribute("href")).toBe(STORES.android.storeUrl);
    });

    it("says so while the stores are being checked, and when they cannot be reached", async () => {
      let fail: (reason: any) => void;
      service.fetchStoreReleases.and.returnValue(new Promise((_, reject) => (fail = reject)));
      await open(settings(0));
      expect(element("ios-in-store").textContent).toContain("AppVersion.storeChecking");

      fail({ status: 500 });
      await settle();
      expect(page.stores).toEqual({ ios: null, android: null });
      expect(page.storesChecked).toBe(true);
      expect(element("ios-in-store").textContent).toContain("AppVersion.storeUnreachable");
      expect(element("android-in-store").textContent).toContain("AppVersion.storeUnreachable");
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
      expect(element("ios-version")).not.toBeNull();
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

    it("refuses an invalid version, and marks the field so its error text shows", async () => {
      await open(settings(1));
      expect(await invalid("ios-version")).toBe(false);
      page.draft.version = "6.2";
      expect(page.canSave).toBe(false);
      expect(await invalid("ios-version")).toBe(true);
      page.draft.version = "";
      expect(await invalid("ios-version")).toBe(true);

      page.draft.version = "6.2.0";
      page.draft.androidVersion = "4.4";
      expect(page.canSave).toBe(false);
      expect(await invalid("android-version")).toBe(true);

      page.draft.androidVersion = "4.4.0";
      expect(await invalid("ios-version")).toBe(false);
      expect(await invalid("android-version")).toBe(false);
      expect(page.canSave).toBe(true);
    });

    it("takes what is typed into a version field", async () => {
      await open(settings(1));
      const input = element("android-version") as HTMLInputElement;
      input.value = "4.4.0";
      input.dispatchEvent(new Event("input"));
      expect(page.draft.androidVersion).toBe("4.4.0");
      expect(page.dirty).toBe(true);
    });

    it("marks a stored version the apps cannot compare as soon as the page opens", async () => {
      await open(settings(0, { version: "v6.1" }));
      expect(await invalid("ios-version")).toBe(true);
      expect(page.versionValid("ios")).toBe(false);
      expect(page.versionValid("android")).toBe(true);
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

    it("names each platform's own version", async () => {
      await open(settings(1));
      const instant = spyOn(TestBed.inject(TranslateService), "instant").and.callThrough();
      expect(page.audienceText).toBe("AppVersion.audienceBoth");
      expect(instant).toHaveBeenCalledWith("AppVersion.audienceBoth", { ios: "6.1.0", android: "4.3.2" });
    });

    it("only needs valid versions for the platforms that are asked", async () => {
      await open(settings(1, { android: false }));
      page.draft.androidVersion = "4.4";
      await settle();
      expect(page.askedVersionsValid).toBe(true);
      expect(text()).toContain("AppVersion.audienceIos");
      // Both versions are still stored, so the draft cannot be saved like this.
      expect(page.canSave).toBe(false);
    });
  });

  describe("following the stores", () => {
    it("takes over each store's version, one platform at a time", async () => {
      await open(settings(1));
      page.setFollowStore("ios", true);
      await settle();
      expect(page.draft.followAppStore).toBe(true);
      expect(page.draft.version).toBe("7.3.0");
      expect(element("ios-version")).toBeNull();
      expect(element("ios-store").textContent).toContain("7.3.0");
      expect(element("ios-store").textContent).toContain("AppVersion.fromStore");
      // Android is untouched.
      expect(page.draft.android).toBe(true);
      expect(page.draft.androidVersion).toBe("4.3.2");
      expect(element("android-version")).not.toBeNull();

      page.setFollowStore("android", true);
      await settle();
      expect(page.draft.followPlayStore).toBe(true);
      expect(page.draft.androidVersion).toBe("4.4.0");
      expect(element("android-version")).toBeNull();
      expect(element("android-store").textContent).toContain("4.4.0");
      expect(page.audience).toBe("both");
    });

    it("compares devices with the store versions, not the stored fallbacks", async () => {
      await open(settings(1, { followAppStore: true, followPlayStore: true, version: "7.1.0" }));
      expect(page.promptVersion("ios")).toBe("7.3.0");
      expect(page.promptVersion("android")).toBe("4.4.0");
      expect(page.dirty).toBe(false);
    });

    it("saves the store versions as the fallbacks", async () => {
      await open(settings(1, { followAppStore: true, followPlayStore: true, version: "7.1.0" }));
      service.saveSettings.and.returnValue(Promise.resolve(settings(2)));
      page.draft.enabled = false;
      await page.save();
      const fields = service.saveSettings.calls.mostRecent().args[1];
      expect(fields.version).toBe("7.3.0");
      expect(fields.androidVersion).toBe("4.4.0");
    });

    it("keeps the stored version and says so when a store cannot be reached", async () => {
      service.fetchStoreReleases.and.returnValue(Promise.resolve({ ios: STORES.ios, android: null }));
      await open(settings(1));
      page.setFollowStore("android", true);
      await settle();
      expect(page.draft.androidVersion).toBe("4.3.2");
      expect(page.promptVersion("android")).toBe("4.3.2");
      expect(element("android-store").textContent).toContain("4.3.2");
      expect(element("android-store").textContent).toContain("AppVersion.fallbackVersion");
      expect(element("android-in-store").textContent).toContain("AppVersion.storeUnreachable");
      expect(page.canSave).toBe(true);
    });

    it("leaves the typed-in version alone when switched off again", async () => {
      await open(settings(1, { followAppStore: true, version: "7.1.0" }));
      page.setFollowStore("ios", false);
      await settle();
      expect(page.promptVersion("ios")).toBe("7.1.0");
      expect(element("ios-version")).not.toBeNull();
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
        androidVersion: "4.3.2",
        major: false,
        followAppStore: false,
        followPlayStore: false,
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
  });

  it("reads a server answer, and rejects one without a revision", () => {
    expect(parseAppVersionSettings({ revision: 0, version: "6.1.0", enabled: true })).toEqual({
      revision: 0,
      enabled: true,
      ios: false,
      android: false,
      version: "6.1.0",
      // An answer from before Android had its own version.
      androidVersion: "6.1.0",
      major: false,
      followAppStore: false,
      followPlayStore: false,
      updatedAt: null,
      updatedBy: null,
    });
    const both = parseAppVersionSettings({ revision: 1, version: "7.3.0", androidVersion: "4.3.2", followPlayStore: true });
    expect(both.androidVersion).toBe("4.3.2");
    expect(both.followPlayStore).toBe(true);
    expect(parseAppVersionSettings(null)).toBeNull();
    expect(parseAppVersionSettings({ version: "6.1.0" })).toBeNull();
  });

  it("reads a store release, and rejects one without a comparable version", () => {
    expect(parseStoreRelease({ version: "7.3.0", releasedAt: null, storeUrl: "u" })).toEqual({
      version: "7.3.0",
      releasedAt: null,
      storeUrl: "u",
    });
    expect(parseStoreRelease({ version: "7.3", storeUrl: "u" })).toBeNull();
    expect(parseStoreRelease({ version: "7.3.0" })).toBeNull();
    expect(parseStoreRelease(null)).toBeNull();
  });

  it("reads the releases of both stores, with null for a store the server could not reach", () => {
    const ios = { version: "7.3.0", releasedAt: "2026-10-30T13:50:02Z", storeUrl: "u" };
    expect(parseStoreReleases({ ios, android: null })).toEqual({ ios, android: null });
    expect(parseStoreReleases(null)).toEqual({ ios: null, android: null });
  });

  it("works out which devices are asked to update", () => {
    const base = {
      enabled: true,
      ios: true,
      android: true,
      version: "6.2.0",
      androidVersion: "4.3.2",
      major: false,
      followAppStore: false,
      followPlayStore: false,
    };
    expect(promptAudience(base)).toBe("both");
    expect(promptAudience({ ...base, android: false })).toBe("ios");
    expect(promptAudience({ ...base, ios: false })).toBe("android");
    expect(promptAudience({ ...base, ios: false, android: false })).toBe("none");
    expect(promptAudience({ ...base, enabled: false })).toBe("none");
  });
});
