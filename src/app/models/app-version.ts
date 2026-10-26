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
  /** "major.minor.patch"; devices on an older version are asked to update. */
  version: string;
  /** Important update: the prompt has no "Not now" button. */
  major: boolean;
  /** Kept for reference; the apps do not compare it. */
  build: string;
}

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
  "major",
  "build",
];

// Same rules as the server. The apps turn "a.b.c" into a * 1e6 + b * 1e3 + c, so
// each part has to fit in three digits.
export const VERSION_PATTERN = /^(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})\.(0|[1-9]\d{0,2})$/;
export const BUILD_PATTERN = /^\d{0,9}$/;

export function isValidAppVersion(value: string): boolean {
  return VERSION_PATTERN.test(value || "");
}

export function isValidBuild(value: string): boolean {
  return BUILD_PATTERN.test(value || "");
}

/** The settings from a server answer, or null when the answer is unusable. */
export function parseAppVersionSettings(raw: any): AppVersionSettings | null {
  if (!raw || typeof raw !== "object" || !Number.isInteger(raw.revision)) {
    return null;
  }
  return {
    revision: raw.revision,
    enabled: raw.enabled === true,
    ios: raw.ios === true,
    android: raw.android === true,
    version: typeof raw.version === "string" ? raw.version : "",
    major: raw.major === true,
    build: typeof raw.build === "string" ? raw.build : "",
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
