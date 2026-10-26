import { NO_ERRORS_SCHEMA } from "@angular/core";
import { ComponentFixture, TestBed } from "@angular/core/testing";
import { RouterTestingModule } from "@angular/router/testing";
import { IonicModule, NavController } from "@ionic/angular";
import { TranslateModule } from "@ngx-translate/core";
import { APP_MANAGEMENT_ROLES, APP_MANAGEMENT_TILES, auditUnreadFrom } from "../../../models/app-management";
import { AuthService } from "../../../services/auth-service.service";
import { AppManagementPage } from "./app-management.page";

describe("AppManagementPage", () => {
  let fixture: ComponentFixture<AppManagementPage>;
  let page: AppManagementPage;
  let roles: string[];
  let auth: { hasAnyRole: jasmine.Spy; getAuditUnreadCount: jasmine.Spy };
  let nav: { navigateForward: jasmine.Spy };

  const text = () => (fixture.nativeElement.textContent || "").replace(/\s+/g, " ");
  const tile = (id: string) => fixture.nativeElement.querySelector(`#app-management-${id}`) as HTMLElement;
  const badge = () => fixture.nativeElement.querySelector("ion-badge") as HTMLElement;

  async function open() {
    fixture = TestBed.createComponent(AppManagementPage);
    page = fixture.componentInstance;
    fixture.detectChanges();
    page.ionViewWillEnter();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(() => {
    roles = ["admin"];
    auth = {
      hasAnyRole: jasmine.createSpy("hasAnyRole").and.callFake((wanted: string[]) => wanted.some((r) => roles.includes(r))),
      getAuditUnreadCount: jasmine.createSpy("unread").and.returnValue(Promise.resolve({ count: 0, alertCount: 0 })),
    };
    nav = { navigateForward: jasmine.createSpy("navigateForward") };
    TestBed.configureTestingModule({
      declarations: [AppManagementPage],
      imports: [IonicModule.forRoot(), TranslateModule.forRoot(), RouterTestingModule],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: NavController, useValue: nav },
      ],
      schemas: [NO_ERRORS_SCHEMA],
    });
  });

  it("is for administrators only", () => {
    expect(APP_MANAGEMENT_ROLES).toEqual(["admin"]);
  });

  it("lists the users, the editor visibility, the app updates and the audit log, in that order", async () => {
    await open();
    expect(page.tiles.map((t) => t.id)).toEqual(["users", "editor-visibility", "app-version", "audit-log"]);
    expect(text()).toContain("AppManagement.users.title");
    expect(text()).toContain("EditorVisibility.cardTitle");
    expect(text()).toContain("AppVersion.cardTitle");
    expect(text()).toContain("AppManagement.auditLog.title");
    expect(text()).toContain("AppManagement.auditLog.description");
  });

  it("opens the page of the tool that is tapped, which keeps its own route", async () => {
    await open();
    tile("users").click();
    expect(nav.navigateForward).toHaveBeenCalledWith("user/user-management");
    tile("editor-visibility").click();
    expect(nav.navigateForward).toHaveBeenCalledWith("user/editor-visibility");
    tile("app-version").click();
    expect(nav.navigateForward).toHaveBeenCalledWith("user/app-version");
    tile("audit-log").click();
    expect(nav.navigateForward).toHaveBeenCalledWith("user/audit-log");
  });

  it("keeps everything in one centred column", async () => {
    await open();
    expect(fixture.nativeElement.querySelector("ion-content > .page-column ion-card")).not.toBeNull();
  });

  it("offers nothing to a contentAdmin, who has no admin tool, and does not ask for audit entries", async () => {
    roles = ["contentAdmin"];
    await open();
    expect(page.tiles.length).toBe(0);
    expect(tile("editor-visibility")).toBeNull();
    expect(tile("app-version")).toBeNull();
    expect(tile("audit-log")).toBeNull();
    expect(auth.getAuditUnreadCount).not.toHaveBeenCalled();
  });

  it("lists the tools of an administrator found anywhere in the role list", async () => {
    roles = ["user", "scholar", "admin"];
    await open();
    expect(page.tiles.length).toBe(APP_MANAGEMENT_TILES.length);
  });

  describe("unread audit entries", () => {
    it("shows no badge when everything has been seen", async () => {
      await open();
      expect(auth.getAuditUnreadCount).toHaveBeenCalledTimes(1);
      expect(badge()).toBeNull();
    });

    it("shows the count on the audit-log tile", async () => {
      auth.getAuditUnreadCount.and.returnValue(Promise.resolve({ count: 3, alertCount: 0 }));
      await open();
      expect(tile("audit-log").contains(badge())).toBe(true);
      expect(badge().textContent!.trim()).toBe("3");
      expect((badge() as any).color).toBe("primary");
      expect(badge().getAttribute("aria-label")).toBe("AppManagement.unread");
    });

    it("turns the badge red when some of them are security alerts", async () => {
      auth.getAuditUnreadCount.and.returnValue(Promise.resolve({ count: 3, alertCount: 1 }));
      await open();
      expect((badge() as any).color).toBe("danger");
    });

    it("refreshes when the user comes back from a tool", async () => {
      await open();
      auth.getAuditUnreadCount.and.returnValue(Promise.resolve({ count: 5, alertCount: 0 }));
      page.ionViewWillEnter();
      await fixture.whenStable();
      fixture.detectChanges();
      expect(badge().textContent!.trim()).toBe("5");
    });

    it("carries on without a badge when the count cannot be loaded", async () => {
      auth.getAuditUnreadCount.and.returnValue(Promise.reject(new Error("offline")));
      await open();
      expect(badge()).toBeNull();
      expect(page.tiles.length).toBe(APP_MANAGEMENT_TILES.length);
    });
  });
});

describe("auditUnreadFrom", () => {
  it("reads the count and the number of alerts", () => {
    expect(auditUnreadFrom({ count: 3, alertCount: 1 })).toEqual({ count: 3, alerts: 1 });
  });

  it("treats a missing or unusable answer as nothing unread", () => {
    expect(auditUnreadFrom(null)).toEqual({ count: 0, alerts: 0 });
    expect(auditUnreadFrom({})).toEqual({ count: 0, alerts: 0 });
    expect(auditUnreadFrom({ count: "n/a", alertCount: undefined })).toEqual({ count: 0, alerts: 0 });
  });
});
