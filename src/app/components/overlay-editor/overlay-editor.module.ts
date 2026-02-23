import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { OverlayEditorComponent } from './overlay-editor.component';

@NgModule({
  declarations: [OverlayEditorComponent],
  imports: [
    CommonModule,
    FormsModule,
    IonicModule
  ],
  exports: [OverlayEditorComponent]
})
export class OverlayEditorModule {}
