import { ComponentFixture, TestBed } from "@angular/core/testing";
import { FormsModule } from "@angular/forms";
import { RouterTestingModule } from "@angular/router/testing";
import { AlertController, IonicModule, ToastController } from "@ionic/angular";
import { TranslateModule } from "@ngx-translate/core";
import { AuthService } from "src/app/services/auth-service.service";
import { MediaAuditPage } from "./media-audit.page";

describe("MediaAuditPage cleanup", () => {
  let fixture: ComponentFixture<MediaAuditPage>;
  let auth: jasmine.SpyObj<AuthService>;
  let dismissRole: string;

  beforeEach(async () => {
    dismissRole = "cancel";
    auth = jasmine.createSpyObj("AuthService", ["GetMediaAudit", "deleteUnreferencedMedia"]);
    auth.GetMediaAudit.and.resolveTo({
      categories: [{ bucket: "photos", label: "Photos", deletable: true, eligibleFiles: 2 }],
      years: [2022, 2021],
      hosts: [],
      page: { bucket: "photos", files: [], hasMore: false, filteredTotal: 0 },
    });
    auth.deleteUnreferencedMedia.and.resolveTo({ deletedFiles: 2, deletedBytes: 2048 });
    await TestBed.configureTestingModule({
      imports: [FormsModule, IonicModule.forRoot(), RouterTestingModule, TranslateModule.forRoot()],
      declarations: [MediaAuditPage],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: ToastController, useValue: { create: async () => ({ present: async () => {} }) } },
        { provide: AlertController, useValue: { create: async () => ({
          present: async () => {},
          onDidDismiss: async () => ({ role: dismissRole }),
        }) } },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(MediaAuditPage);
    await render();
  });

  async function render() {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function selectYear(value: number | "all") {
    fixture.nativeElement.querySelector("ion-select").dispatchEvent(new CustomEvent("ionChange", { detail: { value } }));
    await render();
  }

  it("opens on unreferenced files and allows the UTC year filter to be cleared", async () => {
    expect(auth.GetMediaAudit).toHaveBeenCalledWith(jasmine.objectContaining({ orphans: true, year: null }));
    expect(fixture.nativeElement.querySelector(".cleanup-row")).toBeNull();
    await selectYear(2022);
    expect(auth.GetMediaAudit).toHaveBeenCalledWith(jasmine.objectContaining({ orphans: true, year: 2022 }));
    expect(fixture.nativeElement.querySelector(".cleanup-row").textContent).toContain("Delete unreferenced in 2022");
    await selectYear("all");
    expect(auth.GetMediaAudit.calls.mostRecent().args[0].year).toBeNull();
    expect(fixture.nativeElement.querySelector(".cleanup-row")).toBeNull();
  });

  it("deletes the selected category and year only after confirmation, then refreshes", async () => {
    await selectYear(2021);
    await fixture.componentInstance.confirmDeleteYear();
    expect(auth.deleteUnreferencedMedia).not.toHaveBeenCalled();

    dismissRole = "destructive";
    await fixture.componentInstance.confirmDeleteYear();
    expect(auth.deleteUnreferencedMedia).toHaveBeenCalledTimes(1);
    expect(auth.deleteUnreferencedMedia).toHaveBeenCalledWith("photos", 2021);
    expect(auth.GetMediaAudit.calls.mostRecent().args[0]).toEqual(jasmine.objectContaining({ year: 2021, refresh: true }));
  });
});
