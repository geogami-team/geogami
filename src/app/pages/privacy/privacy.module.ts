import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';

import { IonicModule } from '@ionic/angular';

import { PrivacyPage } from './privacy.page';

import { TranslateModule } from '@ngx-translate/core';


const routes: Routes = [
  {
    path: '',
    component: PrivacyPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild(routes),
    TranslateModule
  ],
  declarations: [PrivacyPage]
})
export class PrivacyPageModule {}
