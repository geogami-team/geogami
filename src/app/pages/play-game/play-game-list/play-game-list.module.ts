import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';

import { IonicModule } from '@ionic/angular';

import { PlayGameListPage } from './play-game-list.page';

import { TranslateModule } from '@ngx-translate/core';
import { PopupComponent } from 'src/app/components/popup/popup.component';
// import { OverlayEditorModule } from 'src/app/components/overlay-editor/overlay-editor.module';

const routes: Routes = [
  {
    path: '',
    component: PlayGameListPage
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    RouterModule.forChild(routes),
    TranslateModule,
    // OverlayEditorModule   // <-- Add this
  ],
  declarations: [PlayGameListPage, PopupComponent ]
})
export class PlayGameListPageModule {}
