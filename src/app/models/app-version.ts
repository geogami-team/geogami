/** Who may change the app update prompt (the server enforces the same rule). */
export const APP_VERSION_MANAGER_ROLES: ReadonlyArray<string> = ["admin"];

/**
 * The fields of the native apps' "please update" prompt that an admin edits. The
 * installed apps read them from GET /appversion/current when they start (see
 * StartPage.checkNewAppVersion), so the names must never change.
 */
export interface AppVersionFields {
  /** Master switch: off, no device is asked to update. */
  enabled: boolean;
  ios: boolean;
  android: boolean;
  /**
   * The iOS version, "major.minor.patch"; devices on an older version are asked to update.
   * (The apps read only `version`; the server puts the asking platform's version there.)
   */
  version: string;
  /** The Android version: Android has its own version numbers. */
  androidVersion: string;
  /** Important update: the prompt has no "Not now" button. */
  major: boolean;
  /**
   * iOS devices are compared with the newest App Store version instead of `version`,
   * which stays the fallback while the App Store cannot be reached.
   */
  followAppStore: boolean;
  /** The same for Android and Google Play, with `androidVersion` as the fallback. */
  followPlayStore: boolean;
}

export type Platform = "ios" | "android";

/** Each platform's version field. */
export const VERSION_FIELD: Readonly<Record<Platform, "version" | "androidVersion">> = {
  ios: "version",
  android: "androidVersion",
};

/** The switch that makes a platform follow its store. */
export const STORE_FLAG: Readonly<Record<Platform, "followAppStore" | "followPlayStore">> = {
  ios: "followAppStore",
  android: "followPlayStore",
};

export interface AppVersionSettings extends AppVersionFields {
  /** 0 until the first save from the App management page. */
  revision: number;
  updatedAt: string | null;
  updatedBy: string | null;
}

export const APP_VERSION_FIELDS: ReadonlyArray<keyof AppVersionFields> = [
  "enabled",
  "ios",
  "android",
  "version",
  "androidVersion",
  "major",
  "followAppStore",
  "followPlayStore",
];

// Same rules as the server. The apps turn "a.b.c" into a * 1e6 + b * 1e3 + c, so
// each part has to fit in three digits.
export const VERSION_PATTERN = /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/;

export function isValidAppVersion(value: string): boolean {
  return VERSION_PATTERN.test(value || "");
}

/** The settings from a server answer, or null when the answer is unusable. */
export function parseAppVersionSettings(raw: any): AppVersionSettings | null {
  if (!raw || typeof raw !== "object" || !Number.isInteger(raw.revision)) {
    return null;
  }
  const version = typeof raw.version === "string" ? raw.version : "";
  return {
    revision: raw.revision,
    enabled: raw.enabled === true,
    ios: raw.ios === true,
    android: raw.android === true,
    version,
    // Before Android had its own version, it was compared with `version`.
    androidVersion: typeof raw.androidVersion === "string" ? raw.androidVersion : version,
    major: raw.major === true,
    followAppStore: raw.followAppStore === true,
    followPlayStore: raw.followPlayStore === true,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : null,
    updatedBy: typeof raw.updatedBy === "string" ? raw.updatedBy : null,
  };
}

export function appVersionFieldsOf(settings: AppVersionFields): AppVersionFields {
  const fields = {} as AppVersionFields;
  for (const field of APP_VERSION_FIELDS) {
    (fields as any)[field] = settings[field];
  }
  return fields;
}

export type PromptAudience = "none" | "ios" | "android" | "both";

/** Which devices the prompt reaches under these settings. */
export function promptAudience(fields: AppVersionFields): PromptAudience {
  if (!fields.enabled || (!fields.ios && !fields.android)) {
    return "none";
  }
  if (fields.ios && fields.android) {
    return "both";
  }
  return fields.ios ? "ios" : "android";
}

/** The newest release in a store, as the server read it. */
export interface StoreRelease {
  version: string;
  /** Known for the App Store only. */
  releasedAt: string | null;
  storeUrl: string;
}

/** The newest release per platform; null for a store the server could not reach. */
export type StoreReleases = Record<Platform, StoreRelease | null>;

export function parseStoreReleases(raw: any): StoreReleases {
  return {
    ios: parseStoreRelease(raw && raw.ios),
    android: parseStoreRelease(raw && raw.android),
  };
}

/** The release from a server answer, or null when the answer is unusable. */
export function parseStoreRelease(raw: any): StoreRelease | null {
  if (!raw || typeof raw !== "object" || !isValidAppVersion(raw.version) || typeof raw.storeUrl !== "string") {
    return null;
  }
  return {
    version: raw.version,
    releasedAt: typeof raw.releasedAt === "string" ? raw.releasedAt : null,
    storeUrl: raw.storeUrl,
  };
}
