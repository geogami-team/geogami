import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { Routes, RouterModule } from "@angular/router";

import { FormsModule } from "@angular/forms";

import { IonicModule } from "@ionic/angular";
import { TranslateModule } from "@ngx-translate/core";

import { MediaAuditPage } from "./media-audit.page";

const routes: Routes = [
  {
    path: "",
    component: MediaAuditPage,
  },
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild(routes),
    TranslateModule,
  ],
  declarations: [MediaAuditPage],
})
export class MediaAuditPageModule {}
