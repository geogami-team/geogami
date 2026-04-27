import { Component, OnInit, OnDestroy } from "@angular/core";
import { ToastController } from "@ionic/angular";
import { AuthService } from "src/app/services/auth-service.service";

@Component({
  selector: "app-verify-email",
  templateUrl: "./verify-email.page.html",
  styleUrls: ["./verify-email.page.scss"],
})
export class VerifyEmailPage implements OnInit, OnDestroy {
  // Snapshot of the currently logged-in user (read once on init).
  user: any = null;

  // Cooldown state — disables the resend button so users don't spam the
  // server. Mirrors the 60s server-side rate limit so users get instant
  // feedback instead of waiting for a 429.
  cooldownSeconds = 0;
  private cooldownTimer: any = null;

  // Loading state for the resend button.
  resending = false;

  constructor(
    private authService: AuthService,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.user = this.authService.getUserValue();
  }

  ngOnDestroy() {
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
  }

  async resendVerification() {
    if (this.resending || this.cooldownSeconds > 0) return;
    this.resending = true;
    try {
      const res = await this.authService.resendMyVerificationEmail();
      if (res && res.status === 200) {
        this.showToast("Verification email sent. Check your inbox (and spam).");
        this.startCooldown(60);
      } else {
        this.showToast("Could not send verification email.");
      }
    } catch (err: any) {
      // 429 = cooldown still active on the server. Mirror that locally.
      if (err && err.status === 429 && err.error) {
        this.showToast(err.error.message || "Please wait before retrying.");
        if (err.error.retryAfter) this.startCooldown(err.error.retryAfter);
      } else if (err && err.error && err.error.message) {
        this.showToast(err.error.message);
      } else {
        this.showToast("Could not send verification email.");
      }
    } finally {
      this.resending = false;
    }
  }

  private startCooldown(seconds: number) {
    this.cooldownSeconds = seconds;
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      this.cooldownSeconds--;
      if (this.cooldownSeconds <= 0) {
        clearInterval(this.cooldownTimer);
        this.cooldownTimer = null;
      }
    }, 1000);
  }

  private async showToast(msg: string) {
    const toast = await this.toastController.create({
      message: msg,
      color: "dark",
      duration: 3500,
    });
    toast.present();
  }
}
