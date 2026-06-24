import { Component, Input, OnInit } from "@angular/core";
import { ModalController } from "@ionic/angular";
import { TranslateService } from "@ngx-translate/core";

import { GamesService } from "../../../services/games.service";
import { EventsService } from "../../../services/events.service";
import { UtilService } from "../../../services/util.service";
import { GeoEvent } from "../../../models/event";

/**
 * Stepper modal to create or edit an event:
 *   1. name + (optional) description
 *   2. choose games from the full games list (owned or not)
 *   3. review + save
 *
 * When `event` is provided the modal runs in edit mode and pre-fills the steps;
 * otherwise it creates a new event. Persists through EventsService and dismisses
 * with { saved: true } so the list page can refresh.
 */
@Component({
  selector: "app-event-form-modal",
  templateUrl: "./event-form-modal.component.html",
  styleUrls: ["./event-form-modal.component.scss"],
})
export class EventFormModalComponent implements OnInit {
  // Existing event when editing; null/undefined when creating.
  @Input() event?: GeoEvent;

  step = 1;
  readonly totalSteps = 3;

  name = "";
  description = "";
  // Set of selected game ids for O(1) toggle/lookup.
  selectedIds = new Set<string>();

  allGames: any[] = [];
  searchTerm = "";
  // Game-world filter for the picker: real-world vs virtual (VR) games.
  gameWorld: "real" | "virtual" = "real";
  loadingGames = true;
  saving = false;

  constructor(
    public modalController: ModalController,
    private gamesService: GamesService,
    private eventsService: EventsService,
    private utilService: UtilService,
    private translate: TranslateService
  ) {}

  async ngOnInit() {
    if (this.event) {
      this.name = this.event.name || "";
      this.description = this.event.description || "";
      (this.event.games || []).forEach((g) =>
        this.selectedIds.add(typeof g === "string" ? g : g._id)
      );
    }
    await this.loadGames();
  }

  private async loadGames() {
    this.loadingGames = true;
    try {
      // minimal + registeredUser → every visible game (name/place/owner),
      // including games the user doesn't own (point 3b).
      const res = await this.gamesService.getGames(true, true);
      // Newest first. The minimal endpoint omits createdAt, so derive the
      // creation time from the Mongo _id (its first 4 bytes are a timestamp).
      this.allGames = (res?.content || []).sort(
        (a, b) => this.createdTime(b) - this.createdTime(a)
      );
    } catch (err) {
      console.log(err);
      this.utilService.showToast(
        this.translate.instant("Events.loadGamesError"),
        "danger"
      );
    } finally {
      this.loadingGames = false;
    }
  }

  // Creation time (seconds since epoch) from a Mongo ObjectId's first 4 bytes.
  private createdTime(game: any): number {
    const id = game?._id;
    if (typeof id !== "string" || id.length < 8) return 0;
    return parseInt(id.substring(0, 8), 16) || 0;
  }

  get filteredGames(): any[] {
    const term = this.searchTerm.trim().toLowerCase();
    const matches = this.allGames.filter((g) => {
      // Single-player games only for now.
      if (g.isMultiplayerGame) return false;
      // World filter: virtual (VR) games vs real-world games.
      const isVirtual = !!g.isVRWorld;
      if (this.gameWorld === "virtual" && !isVirtual) return false;
      if (this.gameWorld === "real" && isVirtual) return false;
      // Free-text search on name / place.
      if (
        term &&
        !(
          (g.name || "").toLowerCase().includes(term) ||
          (g.place || "").toLowerCase().includes(term)
        )
      ) {
        return false;
      }
      return true;
    });
    // Selected games first, then the rest — each group keeps the newest-first
    // order from load (stable partition).
    const selected = matches.filter((g) => this.selectedIds.has(g._id));
    const unselected = matches.filter((g) => !this.selectedIds.has(g._id));
    return [...selected, ...unselected];
  }

  get selectedCount(): number {
    return this.selectedIds.size;
  }

  // Games selected, in the order they appear in the full list (for the review step).
  get selectedGames(): any[] {
    return this.allGames.filter((g) => this.selectedIds.has(g._id));
  }

  isSelected(game: any): boolean {
    return this.selectedIds.has(game._id);
  }

  toggleGame(game: any) {
    if (this.selectedIds.has(game._id)) {
      this.selectedIds.delete(game._id);
    } else {
      this.selectedIds.add(game._id);
    }
  }

  // Step-1 validity gate: a name is required.
  get canLeaveStep1(): boolean {
    return this.name.trim().length > 0;
  }

  next() {
    if (this.step === 1 && !this.canLeaveStep1) {
      this.utilService.showToast(
        this.translate.instant("Events.nameRequired"),
        "warning"
      );
      return;
    }
    if (this.step < this.totalSteps) this.step++;
  }

  back() {
    if (this.step > 1) this.step--;
  }

  async save() {
    if (!this.canLeaveStep1) {
      this.step = 1;
      return;
    }
    this.saving = true;
    const payload: GeoEvent = {
      _id: this.event?._id,
      name: this.name.trim(),
      description: this.description.trim(),
      games: Array.from(this.selectedIds),
    };
    try {
      if (this.event?._id) {
        await this.eventsService.updateEvent(payload);
      } else {
        await this.eventsService.createEvent(payload);
      }
      this.utilService.showToast(
        this.translate.instant("Events.saved"),
        "success"
      );
      this.modalController.dismiss({ saved: true });
    } catch (err) {
      console.log(err);
      // 409 → duplicate name for this owner.
      const msg =
        err?.status === 409
          ? this.translate.instant("Events.duplicateName")
          : this.translate.instant("Events.saveError");
      this.utilService.showToast(msg, "danger");
    } finally {
      this.saving = false;
    }
  }

  dismiss() {
    this.modalController.dismiss();
  }
}
