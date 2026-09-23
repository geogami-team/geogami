import { Component, OnInit } from "@angular/core";
import { ToastController } from "@ionic/angular";
import { AuthService } from "src/app/services/auth-service.service";

@Component({
  selector: "app-audit-log",
  templateUrl: "./audit-log.page.html",
  styleUrls: ["./audit-log.page.scss"],
})
export class AuditLogPage implements OnInit {
  entries: any[] = [];
  loading = false;
  hasMore = false;
  severity: "all" | "alert" = "all";

  // The admin's "last seen" mark as it was when this page opened, captured
  // BEFORE we mark the log as read. Entries newer than this are highlighted as
  // new for this visit only — on the next visit the mark has moved, so they
  // render normally.
  newSince: Date = null;

  constructor(
    private authService: AuthService,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    // Read the current "seen" mark first, so we still know which entries were
    // unread once we clear it below.
    try {
      const unread: any = await this.authService.getAuditUnreadCount();
      this.newSince = unread && unread.lastSeenAt ? new Date(unread.lastSeenAt) : null;
    } catch {
      this.newSince = null; // highlight is cosmetic; ignore failures
    }

    await this.reload();

    // The admin has now opened the log — clear their unread badge.
    this.authService.markAuditSeen().catch(() => {});
  }

  // True for entries that arrived since this admin last opened the log.
  isNew(entry: any): boolean {
    if (!this.newSince || !entry || !entry.createdAt) return false;
    return new Date(entry.createdAt) > this.newSince;
  }

  onSeverityChange() {
    this.reload();
  }

  async reload() {
    this.entries = [];
    this.hasMore = false;
    await this.loadMore();
  }

  async loadMore() {
    if (this.loading) return;
    this.loading = true;
    try {
      const before = this.entries.length
        ? this.entries[this.entries.length - 1].createdAt
        : undefined;
      const res: any = await this.authService.getAuditLogs({
        limit: 50,
        before,
        severity: this.severity === "alert" ? "alert" : undefined,
      });
      this.entries = this.entries.concat(res.items || []);
      this.hasMore = !!res.hasMore;
    } catch (e) {
      const t = await this.toastController.create({
        message: "Could not load the audit log.",
        duration: 2500,
        color: "danger",
      });
      t.present();
    } finally {
      this.loading = false;
    }
  }

  // Short, human-readable label for an action code.
  actionLabel(action: string): string {
    const map: { [k: string]: string } = {
      "account.delete.self": "Account deleted (by owner)",
      "account.delete.admin": "Account deleted (by admin)",
      "account.password.change": "Password changed",
      "account.password.reset": "Password reset",
      "account.email.change": "Email change requested",
      "user.role.change": "Role changed",
      "security.rateLimit": "Rate limit reached",
    };
    return map[action] || action;
  }

  // Compact one-line description of the meta object, when useful.
  metaSummary(entry: any): string {
    const m = entry && entry.meta ? entry.meta : {};
    if (entry.action === "user.role.change") {
      const from = Array.isArray(m.from) ? m.from.join(",") : m.from;
      const to = Array.isArray(m.to) ? m.to.join(",") : m.to;
      return `${from || "?"} → ${to || "?"}`;
    }
    if (entry.action === "account.email.change") {
      return `${m.from || "?"} → ${m.to || "?"}`;
    }
    if (entry.action === "security.rateLimit") {
      return `${m.endpoint || "?"}${
        m.attemptedUsername ? " · tried: " + m.attemptedUsername : ""
      }`;
    }
    return "";
  }
}
