import { Component, OnInit, ViewChild } from "@angular/core";
import { SelectionModel } from "@angular/cdk/collections";
import { AlertController, ModalController, ToastController } from "@ionic/angular";
import { UserDetailsModalComponent } from "./user-details-modal/user-details-modal.component";
import { TranslateService } from "@ngx-translate/core";
import { AuthService } from "src/app/services/auth-service.service";
import { MatTableDataSource } from "@angular/material/table";
import { MatPaginator } from "@angular/material/paginator";
import { MatSort } from "@angular/material/sort";

@Component({
  selector: "app-user-management",
  templateUrl: "./user-management.page.html",
  styleUrls: ["./user-management.page.scss"],
})
export class UserManagementPage implements OnInit {
  users: any; // To hold users info

  displayedColumns: string[] = [
    "select",
    "#",
    "username",
    "email",
    "emailConfirmed",
    "createdAt",
    "roles",
    "action",
  ];
  dataSource: MatTableDataSource<any>;
  selection = new SelectionModel<any>(true, []);

  // Advanced filter state. Keyed by the mat-select values in the template.
  filterRole: "all" | "admin" | "contentAdmin" | "trackAccess" | "scholar" | "user" = "all";
  filterVerified: "all" | "yes" | "no" = "all";
  // Held so the text search can be combined with role/verified filters.
  private textFilter = "";

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(
    private authService: AuthService,
    public _translate: TranslateService,
    public toastController: ToastController,
    public alertController: AlertController,
    public modalController: ModalController
  ) {}

  // Open a modal with the user's profile and (lazily-loaded) created games.
  async openUserDetails(user: any) {
    if (!user || !user._id) return;
    const modal = await this.modalController.create({
      component: UserDetailsModalComponent,
      componentProps: { user },
      cssClass: "user-details-modal",
    });
    await modal.present();
  }

  ngAfterViewInit() {
    if (this.dataSource) {
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    }
  }

  ngOnInit() {
    // Get all users
    this.authService.GetUsers().then((res) => {
      this.users = res.map((obj) => ({ ...obj, roleIsUpdated: false }));
      this.initializeDataSource(this.users);
    });
  }

  initializeDataSource(usersData) {
    // Assign the data to the data source for the table to render
    this.dataSource = new MatTableDataSource(usersData);
    // Custom predicate so the single mat-table filter string can encode the
    // text search + role + verified state as a single JSON blob. Keeps us on
    // client-side filtering without reimplementing the table datasource.
    this.dataSource.filterPredicate = (row: any, filter: string) => {
      let f: { text: string; role: string; verified: string };
      try {
        f = JSON.parse(filter);
      } catch {
        f = { text: filter || "", role: "all", verified: "all" };
      }
      const text = (f.text || "").trim().toLowerCase();
      if (text) {
        const hay = `${row.username || ""} ${row.email || ""}`.toLowerCase();
        if (!hay.includes(text)) return false;
      }
      if (f.role && f.role !== "all") {
        if (!Array.isArray(row.roles) || !row.roles.includes(f.role)) return false;
      }
      if (f.verified === "yes" && !row.emailIsConfirmed) return false;
      if (f.verified === "no" && row.emailIsConfirmed) return false;
      return true;
    };
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
    this.applyAdvancedFilters();
  }

  applyAdvancedFilters() {
    if (!this.dataSource) return;
    this.dataSource.filter = JSON.stringify({
      text: this.textFilter,
      role: this.filterRole,
      verified: this.filterVerified,
    });
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  resetFilters(input?: HTMLInputElement) {
    this.filterRole = "all";
    this.filterVerified = "all";
    this.textFilter = "";
    if (input) input.value = "";
    this.applyAdvancedFilters();
  }

  // Single-role selector. We still store roles as an array in the DB (the
  // Mongoose schema defines it that way), but the admin only assigns one
  // primary role from the UI. Legacy users that were saved with multiple
  // roles get collapsed to the newly-selected single role on next save —
  // until then their original roles remain intact.
  async changeRole(roleValue: string, userEmail: string) {
    if (!userEmail || !roleValue) return;
    this.users.find((user) => {
      if (user.email === userEmail) {
        user.roleIsUpdated = true;
        user.roles = [roleValue];
        return user;
      }
    });
  }

  // save updated role
  saveRoleUpdate(userEmail) {
    if (userEmail != undefined) {
      // get user whose role has been changed
      let user = this.users.find((user) => user.email == userEmail);

      this.authService.updateUserRole(user).then((res) => {
        if (res.status == 200) {
          user.roleIsUpdated = false;
          this.showToast("User role was successfully updated!");
        }
      });
    }
  }

  // Admin-only: permanently delete a user after a type-to-confirm prompt.
  async deleteUser(user: any) {
    console.log("🚀 ~ UserManagementPage ~ deleteUser ~ user:", user)
    if (!user || !user._id) return;

    // Prevent an admin from deleting themselves via this page — would log them out
    // and (if they were the last admin) lock the system.
    const currentUser = this.authService.getUserValue();
    if (currentUser && (currentUser as any)._id === user._id) {
      this.showToast("You cannot delete your own account here.");
      return;
    }

    const roleLabel = user.roles && user.roles.length ? user.roles.join(", ") : "user";
    // createdAt is an ISO timestamp from Mongo; slice to YYYY-MM-DD for display.
    const createdAt = user.createdAt ? user.createdAt.slice(0, 10) : "—";

    const alert = await this.alertController.create({
      cssClass: "delete-user-alert",
      header: "Delete user?",
      subHeader: `${user.username} · ${roleLabel}`,
      // Inline styles are used because ion-alert renders in an overlay outside
      // this component's view encapsulation, so the page .scss cannot reach it.
      message:
        `<div style="text-align:left">` +
        `<p><strong>Email:</strong> ${user.email}</p>` +
        `<p><strong>Joined:</strong> ${createdAt}</p>` +
        `<p style="color:var(--ion-color-danger);margin-top:12px">` +
        `This permanently deletes the user. This action cannot be undone.</p>` +
        `<p>Type <strong>${user.username}</strong> below to confirm.</p>` +
        `</div>`,
      inputs: [
        {
          name: "confirmation",
          type: "text",
          placeholder: user.username,
          attributes: { autocapitalize: "off", autocomplete: "off" },
        },
      ],
      buttons: [
        { text: "Cancel", role: "cancel" },
        {
          text: "Delete permanently",
          role: "destructive",
          cssClass: "alert-button-danger",
          handler: (data) => {
            // Type-to-confirm: must exactly match the username before we proceed.
            if (!data || data.confirmation !== user.username) {
              this.showToast("Confirmation text did not match. User not deleted.");
              // Returning false keeps the alert open so the admin can retry.
              return false;
            }
            this.performDelete(user);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  // Actual DELETE call + optimistic table update. Extracted from deleteUser()
  // so the confirm handler stays focused on validation.
  private performDelete(user) {
    this.authService
      .deleteUserById(user._id)
      .then((res) => {
        if (res && (res.status === 200 || res.status === 204)) {
          // Remove locally instead of re-fetching the whole user list.
          this.users = this.users.filter((u) => u._id !== user._id);
          this.initializeDataSource(this.users);
          this.showToast(`"${user.username}" deleted.`);
        } else {
          this.showToast("Could not delete user.");
        }
      })
      .catch(() => this.showToast("Could not delete user."));
  }

  // Admin: resend the email-verification link to the user.
  async resendVerification(user: any) {
    if (!user || !user._id) return;
    if (user.emailIsConfirmed) {
      this.showToast("This user's email is already confirmed.");
      return;
    }
    const alert = await this.alertController.create({
      header: "Resend verification email?",
      message: `Send a new verification link to <strong>${user.email}</strong>?`,
      buttons: [
        { text: "Cancel", role: "cancel" },
        {
          text: "Send",
          handler: () => {
            this.authService
              .resendVerificationEmail(user._id)
              .then((res) => {
                if (res && res.status === 200) {
                  this.showToast("Verification email sent.");
                } else {
                  this.showToast("Could not send verification email.");
                }
              })
              .catch(() => this.showToast("Could not send verification email."));
          },
        },
      ],
    });
    await alert.present();
  }

  // Admin: trigger a password-reset email (user gets a verification code by mail).
  async triggerPasswordReset(user: any) {
    if (!user || !user._id) return;
    const alert = await this.alertController.create({
      header: "Send password reset?",
      message:
        `Send a password-reset email to <strong>${user.email}</strong>?<br/><br/>` +
        `The user will receive a verification code they can use to set a new password.`,
      buttons: [
        { text: "Cancel", role: "cancel" },
        {
          text: "Send",
          handler: () => {
            this.authService
              .triggerPasswordReset(user._id)
              .then((res) => {
                if (res && res.status === 200) {
                  this.showToast("Password reset email sent.");
                } else {
                  this.showToast("Could not send password reset email.");
                }
              })
              .catch(() => this.showToast("Could not send password reset email."));
          },
        },
      ],
    });
    await alert.present();
  }

  // show feedback after updating user role
  async showToast(msg) {
    const toast = await this.toastController.create({
      message: msg,
      color: "dark",
      animated: true,
      duration: 2000,
    });
    toast.present();
  }

  // material table filter — text box only; combines with role/verified filters.
  applyFilter(event: Event) {
    this.textFilter = (event.target as HTMLInputElement).value || "";
    this.applyAdvancedFilters();
  }

  // ── Selection helpers ──────────────────────────────────────────────
  // Whether every *visible* (filtered) row is selected.
  isAllSelected(): boolean {
    const filtered = this.dataSource?.filteredData || [];
    return filtered.length > 0 && filtered.every((row) => this.selection.isSelected(row));
  }

  // Toggle all visible rows on/off.
  toggleAllRows() {
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      (this.dataSource?.filteredData || []).forEach((row) => this.selection.select(row));
    }
  }

  // ── Bulk actions ───────────────────────────────────────────────────

  // Bulk delete: confirm once, then delete all selected users sequentially.
  async bulkDelete() {
    const selected = this.selection.selected;
    if (!selected.length) return;

    const currentUser = this.authService.getUserValue();
    const safe = selected.filter((u) => !(currentUser && (currentUser as any)._id === u._id));
    if (safe.length < selected.length) {
      this.showToast("Your own account was excluded from the selection.");
    }
    if (!safe.length) return;

    const alert = await this.alertController.create({
      header: `Delete ${safe.length} user${safe.length > 1 ? "s" : ""}?`,
      message: `This will permanently delete the selected users. This cannot be undone.`,
      buttons: [
        { text: "Cancel", role: "cancel" },
        {
          text: "Delete all",
          role: "destructive",
          cssClass: "alert-button-danger",
          handler: () => {
            this.performBulkDelete(safe);
          },
        },
      ],
    });
    await alert.present();
  }

  private async performBulkDelete(usersToDelete: any[]) {
    let deleted = 0;
    for (const u of usersToDelete) {
      try {
        const res = await this.authService.deleteUserById(u._id);
        if (res && (res.status === 200 || res.status === 204)) {
          this.users = this.users.filter((x) => x._id !== u._id);
          deleted++;
        }
      } catch {}
    }
    this.selection.clear();
    this.initializeDataSource(this.users);
    this.showToast(`${deleted} of ${usersToDelete.length} user(s) deleted.`);
  }

  // Bulk role change: set one role for all selected users.
  async bulkChangeRole() {
    const selected = this.selection.selected;
    if (!selected.length) return;

    const alert = await this.alertController.create({
      header: `Set role for ${selected.length} user${selected.length > 1 ? "s" : ""}`,
      inputs: [
        { type: "radio", label: "admin", value: "admin" },
        { type: "radio", label: "content admin", value: "contentAdmin" },
        { type: "radio", label: "track access", value: "trackAccess" },
        { type: "radio", label: "scholar", value: "scholar" },
        { type: "radio", label: "user", value: "user", checked: true },
      ],
      buttons: [
        { text: "Cancel", role: "cancel" },
        {
          text: "Apply",
          handler: (role: string) => {
            if (!role) return false;
            this.performBulkRoleChange(selected, role);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private async performBulkRoleChange(users: any[], role: string) {
    let updated = 0;
    for (const u of users) {
      u.roles = [role];
      try {
        const res = await this.authService.updateUserRole(u);
        if (res && res.status === 200) {
          u.roleIsUpdated = false;
          updated++;
        }
      } catch {}
    }
    this.selection.clear();
    this.initializeDataSource(this.users);
    this.showToast(`${updated} of ${users.length} user(s) updated to "${role}".`);
  }

  // ── Create / invite user ──────────────────────────────────────────

  async createUser() {
    const alert = await this.alertController.create({
      header: "Create new user",
      inputs: [
        { name: "username", type: "text", placeholder: "Username (min 4 chars)" },
        { name: "email", type: "email", placeholder: "Email" },
        {
          name: "password",
          type: "password",
          placeholder: "Temporary password (min 8 chars)",
        },
      ],
      buttons: [
        { text: "Cancel", role: "cancel" },
        {
          text: "Create",
          handler: (data) => {
            if (!data.username || data.username.length < 4) {
              this.showToast("Username must be at least 4 characters.");
              return false;
            }
            if (!data.email || !data.email.includes("@")) {
              this.showToast("Please enter a valid email.");
              return false;
            }
            if (!data.password || data.password.length < 8) {
              this.showToast("Password must be at least 8 characters.");
              return false;
            }
            this.performCreateUser(data);
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private performCreateUser(data: { username: string; email: string; password: string }) {
    this.authService
      .createUser(data)
      .then((res) => {
        if (res && res.status === 200) {
          // Re-fetch all users so the new user's server-generated fields
          // (_id, createdAt, roles default, etc.) are fully available.
          this.authService.GetUsers().then((all) => {
            this.users = all.map((obj) => ({ ...obj, roleIsUpdated: false }));
            this.initializeDataSource(this.users);
          });
          this.showToast(`User "${data.username}" created.`);
        } else {
          this.showToast("Could not create user.");
        }
      })
      .catch((err) => {
        const msg = err?.error?.message || err?.error?.error?.message || "Could not create user.";
        this.showToast(msg);
      });
  }
}
