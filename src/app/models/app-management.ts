import { APP_VERSION_MANAGER_ROLES } from "./app-version";
import { EDITOR_VISIBILITY_MANAGER_ROLES } from "./editor-features";

/** Who may open the App management hub (the page and its start-page card). */
export const APP_MANAGEMENT_ROLES: ReadonlyArray<string> = ["admin"];

export interface AppManagementTile {
  id: string;
  icon: string;
  titleKey: string;
  descriptionKey: string;
  /** Existing page the tile opens; its own route keeps its own guard. */
  route: string;
  /** Roles that see the tile (the server enforces the same rules on the API). */
  roles: ReadonlyArray<string>;
}

/** The unread audit entries from the server's answer; anything unusable counts as none. */
export function auditUnreadFrom(res: any): { count: number; alerts: number } {
  return {
    count: (res && Number(res.count)) || 0,
    alerts: (res && Number(res.alertCount)) || 0,
  };
}

/** The tools in the App management hub, in the order they are listed. */
export const APP_MANAGEMENT_TILES: ReadonlyArray<AppManagementTile> = [
  {
    id: "users",
    icon: "people-outline",
    titleKey: "AppManagement.users.title",
    descriptionKey: "AppManagement.users.description",
    route: "user/user-management",
    roles: ["admin"],
  },
  {
    id: "editor-visibility",
    icon: "options-outline",
    titleKey: "EditorVisibility.cardTitle",
    descriptionKey: "EditorVisibility.cardDescription",
    route: "user/editor-visibility",
    roles: EDITOR_VISIBILITY_MANAGER_ROLES,
  },
  {
    id: "app-version",
    icon: "phone-portrait-outline",
    titleKey: "AppVersion.cardTitle",
    descriptionKey: "AppVersion.cardDescription",
    route: "user/app-version",
    roles: APP_VERSION_MANAGER_ROLES,
  },
  {
    id: "audit-log",
    icon: "shield-checkmark-outline",
    titleKey: "AppManagement.auditLog.title",
    descriptionKey: "AppManagement.auditLog.description",
    route: "user/audit-log",
    roles: ["admin"],
  },
];
