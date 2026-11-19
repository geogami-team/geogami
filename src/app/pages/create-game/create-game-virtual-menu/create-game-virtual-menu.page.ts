import { Location } from "@angular/common";
import { Component, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { NavController } from "@ionic/angular";
import { getSelectableVirEnvHeaders } from "src/app/models/virEnvsHeader";
import { GameFactoryService } from "src/app/services/game-factory.service";

@Component({
  selector: "app-create-game-virtual-menu",
  templateUrl: "./create-game-virtual-menu.page.html",
  styleUrls: ["./create-game-virtual-menu.page.scss"],
})
export class CreateGameVirtualMenuPage implements OnInit {
  // Multiplayer mode
  isRealWorld: boolean = false;
  isSingleMode: boolean = false;
  bundle: any;
  virEnvType: string; // new var. to store vir env type

  readonly virEnvTypesList = getSelectableVirEnvHeaders();

  constructor(
    public navCtrl: NavController,
    private router: Router,
  ) {
    // Get sent data (not visible on url)
    if (this.router.getCurrentNavigation().extras.state) {
      this.isRealWorld =
        this.router.getCurrentNavigation().extras.state.isRealWorld;
      this.isSingleMode =
        this.router.getCurrentNavigation().extras.state.isSingleMode;
    } else {
      // if sent data from `game-type-menu` is lost due to reload page, redirect user to previous page
      navCtrl.back();
    }
  }

  ngOnInit() {
    this.bundle = {
      isRealWorld: this.isRealWorld,
      isSingleMode: this.isSingleMode,
      virEnvType: "VirEnv_1", // Defualt env.
    };
    // });

    //* To make sure that game is clear when choosing another vir. env. (no need for it now)
    // this.gameFactory.flushGame(); // clear game data
  }

  navigateCreateVRGame(virEnvType) {
    this.bundle.virEnvType = virEnvType;
    this.router.navigate(["create-game-list"], { state: this.bundle });
  }
}
