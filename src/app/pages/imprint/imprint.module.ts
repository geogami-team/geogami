import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Routes, RouterModule } from '@angular/router';

import { IonicModule } from '@ionic/angular';

import { ImprintPage } from './imprint.page';

import { TranslateModule } from '@ngx-translate/core';


const routes: Routes = [
  {
    path: '',
    component: ImprintPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    RouterModule.forChild(routes),
    TranslateModule
  ],
  declarations: [ImprintPage]
})
export class ImprintPageModule {}
