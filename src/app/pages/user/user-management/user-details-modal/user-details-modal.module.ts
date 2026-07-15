import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';

import { IonicModule } from '@ionic/angular';

import { UserDetailsModalComponent } from './user-details-modal.component';

// Declared in its own module (instead of user-management.module.ts) so the
// modal can also be opened from other pages, e.g. the game list's
// creator-info modal ("More details about user").
@NgModule({
  imports: [CommonModule, IonicModule],
  declarations: [UserDetailsModalComponent],
  exports: [UserDetailsModalComponent],
})
export class UserDetailsModalModule {}
