import { Component, OnInit, ViewChild } from "@angular/core";
import { AlertController, ToastController } from "@ionic/angular";
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
    "#",
    "username",
    "email",
    "createdAt",
    "roles",
    "action",
  ];
  dataSource: MatTableDataSource<any>;

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;

  constructor(
    private authService: AuthService,
    public _translate: TranslateService,
    public toastController: ToastController,
    public alertController: AlertController
  ) {}

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
    // console.log("this.dataSource: ", this.dataSource);
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  // update user role
  async changeRole(roleValue, userEmail) {
    if (userEmail != undefined) {
      // console.log("userEmail1: ", userEmail);
      // console.log("roleValue1: ", roleValue);

      // update user role and change save icon color to blue
      this.users.find((user) => {
        if (user.email == userEmail) {
          user.roleIsUpdated = true;
          user.roles = [roleValue];
          // console.log("user: ", user);
          return user;
        }
      });
    }
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

  // material table filter
  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }
}
