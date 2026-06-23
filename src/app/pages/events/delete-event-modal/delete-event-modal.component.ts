import { Component, Input } from "@angular/core";
import { ModalController } from "@ionic/angular";

/**
 * Confirmation modal for deleting an event. The user must type the event's exact
 * name before the Delete button enables, guarding against accidental deletion.
 * Dismisses with { confirmed: true } when deletion is confirmed.
 */
@Component({
  selector: "app-delete-event-modal",
  templateUrl: "./delete-event-modal.component.html",
  styleUrls: ["./delete-event-modal.component.scss"],
})
export class DeleteEventModalComponent {
  @Input() eventName = "";
  typedName = "";

  constructor(public modalController: ModalController) {}

  get nameMatches(): boolean {
    return this.typedName.trim() === this.eventName.trim();
  }

  confirm() {
    if (!this.nameMatches) return;
    this.modalController.dismiss({ confirmed: true });
  }

  dismiss() {
    this.modalController.dismiss();
  }
}
