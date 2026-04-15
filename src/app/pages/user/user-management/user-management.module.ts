import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';

import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { UserManagementPage } from './user-management.page';
import { UserDetailsModalComponent } from './user-details-modal/user-details-modal.component';
import { TranslateModule } from '@ngx-translate/core';

import { MaterialModule } from '../../../material.module';


const routes: Routes = [
  {
    path: '',
    component: UserManagementPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild(routes),
    TranslateModule,
    MaterialModule,
  ],
  declarations: [UserManagementPage, UserDetailsModalComponent]
})
export class UserManagementPageModule { }
