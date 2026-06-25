import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Routes, RouterModule } from '@angular/router';

import { IonicModule } from '@ionic/angular';

import { PlayGameListPage } from './play-game-list.page';

import { TranslateModule } from '@ngx-translate/core';
import { PopupComponent } from 'src/app/components/popup/popup.component';
import { ShareGameModalComponent } from './share-game-modal/share-game-modal.component';

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
    TranslateModule
  ],
  declarations: [PlayGameListPage, PopupComponent, ShareGameModalComponent ]
})
export class PlayGameListPageModule {}
