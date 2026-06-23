import { NgModule } from "@angular/core";
import { CommonModule } from "@angular/common";
import { FormsModule } from "@angular/forms";
import { Routes, RouterModule } from "@angular/router";

import { IonicModule } from "@ionic/angular";
import { TranslateModule } from "@ngx-translate/core";

import { EventsPage } from "./events.page";
import { EventFormModalComponent } from "./event-form-modal/event-form-modal.component";
import { DeleteEventModalComponent } from "./delete-event-modal/delete-event-modal.component";

const routes: Routes = [
  {
    path: "",
    component: EventsPage,
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
  declarations: [
    EventsPage,
    EventFormModalComponent,
    DeleteEventModalComponent,
  ],
})
export class EventsPageModule {}
