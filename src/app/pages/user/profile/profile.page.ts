import { Component, OnInit } from "@angular/core";
import { AuthService } from "src/app/services/auth-service.service";
import { FormBuilder, Validators } from "@angular/forms";
import { AlertController, NavController } from "@ionic/angular";
import { TranslateService } from "@ngx-translate/core";
import { LanguageService } from "src/app/services/language.service";
import { UtilService } from "src/app/services/util.service";

@Component({
  selector: "app-profile",
  templateUrl: "./profile.page.html",
  styleUrls: ["./profile.page.scss"],
})
export class ProfilePage implements OnInit {
  profileForm;
  error: string;
  register;
  saving = false;

  user;
  languages: { value: string; img: string; text: string }[] = [];
  userSub = this.authService.getUser();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    public navCtrl: NavController,
    private alertController: AlertController,
    public _translate: TranslateService,
    private languageService: LanguageService,
    private utilService: UtilService
  ) {}

  ngOnInit(): void {
    this.languages = this.languageService.getLangauges();

    // Get user
    this.userSub.subscribe((event) => {
      if (event != null) {
        this.user = event;

        this.profileForm = this.fb.group({
          name: [this.user.name || ""],
          // Legacy accounts may store locale-style values ("de_DE");
          // compare on the first two letters.
          language: [
            (this.user.language || "de").toLowerCase().slice(0, 2),
            [Validators.required],
          ],
        });
      }
    });

    this.authService.getErrorMessage().subscribe((e) => {
      this.error = e;
    });

    this.authService.getRegisterStatus().subscribe((r) => {
      this.register = r;
    });
  }

  async updateUser() {
    if (!this.profileForm || this.profileForm.invalid || this.saving) {
      return;
    }
    this.saving = true;
    const { name, language } = this.profileForm.getRawValue();

    try {
      const res = await this.authService.updateProfile({ name, language });
      if (res && res.success) {
        // Switch the app language right away so the change is visible.
        this.languageService.setLanguage(language);
        this.utilService.showToast(
          this._translate.instant("User.profileUpdated"),
          "dark",
          3000
        );
      } else {
        this.utilService.showToast(
          (res && res.msg) ||
            this._translate.instant("User.profileUpdateFailed"),
          "danger",
          3500
        );
      }
    } catch (err) {
      this.utilService.showToast(
        (err && err.error && err.error.msg) ||
          this._translate.instant("User.profileUpdateFailed"),
        "danger",
        3500
      );
    } finally {
      this.saving = false;
    }
  }

  // Initials for the avatar circle, from the display name (fallback:
  // username), e.g. "Jane Doe" -> "JD".
  get initials(): string {
    const source = ((this.user && (this.user.name || this.user.username)) || "")
      .trim();
    if (!source) {
      return "?";
    }
    const parts = source.split(/\s+/);
    const first = parts[0].charAt(0);
    const last = parts.length > 1 ? parts[parts.length - 1].charAt(0) : "";
    return (first + last).toUpperCase();
  }

  logout() {
    this.authService.logout();
  }

  // Delete user account
  async deleteMyAccount() {
    const alert = await this.alertController.create({
      backdropDismiss: false, // disable alert dismiss when backdrop is clicked
      header: this._translate.instant("User.deleteAccountHeader"),
      message: this._translate.instant("User.deleteAccountMsg"),
      buttons: [
        {
          text: this._translate.instant("User.cancel"),
          handler: () => {
            // Do nothing
          },
        },
        {
          text: this._translate.instant("User.deleteAccount"),
          cssClass: "alert-button-confirm",
          handler: () => {
            this.authService.DeleteAccountLogout(this.user);
          },
        },
      ],
    });
    await alert.present();
  }

  navigateRegister() {
    this.navCtrl.navigateForward("user/register");
  }
}
