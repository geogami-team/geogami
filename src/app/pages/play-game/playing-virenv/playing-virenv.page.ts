import { HttpParams } from "@angular/common/http";
import {
  Component,
  ElementRef,
  HostListener,
  OnInit,
  SecurityContext,
  ViewChild,
} from "@angular/core";
import { DomSanitizer, SafeResourceUrl } from "@angular/platform-browser";
import { ActivatedRoute } from "@angular/router";
import { NavController } from "@ionic/angular";
import { VE_CLOSE_FRAME_MESSAGE } from "src/app/services/socket.service";
import { environment } from "src/environments/environment";

@Component({
  selector: "app-playing-virenv",
  templateUrl: "./playing-virenv.page.html",
  styleUrls: ["./playing-virenv.page.scss"],
})
export class PlayingVirenvPage implements OnInit {
  @ViewChild("veFrame") veFrame: ElementRef<HTMLIFrameElement>;

  webGLURL: string = null;
  url: string = null;
  urlSafe: SafeResourceUrl;

  constructor(
    private route: ActivatedRoute,
    private readonly domSanitizer: DomSanitizer,
    private navCtrl: NavController
  ) {}

  ngOnInit() {
    this.route.params.subscribe((params) => {
      if (params) {
        // console.log("🚀 ~ PlayingVirenvPage ~ this.route.params.subscribe ~ params:", params);
        const queryParams = JSON.parse(params.queryParams);
        let queryParamsString = new HttpParams({
          fromObject: queryParams,
        }).toString();

        // console.log("🚀 ~ PlayingVirenvPage ~ this.route.params.subscribe ~ queryParamsString:", queryParamsString);

        this.webGLURL = `${environment.webglURL}?`.concat(queryParamsString);

        // The url needs to be sanitized, before being used in iframe
        this.urlSafe = this.sanitizedURL(this.webGLURL);
        console.log(
          "🚀 ~ PlayingVirenvPage ~ this.route.params.subscribe ~ webGLURL:",
          this.urlSafe
        );
      } else {
        console.log("🚀 ~ url is missing");
      }
    });
  }

  /* To sanitize url before being shown in iframe */
  sanitizedURL(url: string) {
    return this.domSanitizer.bypassSecurityTrustResourceUrl(this.webGLURL);
  }

  /**
   * Messages from the WebGL frame. Angular (v12) registers only one @HostListener per
   * event on a component (the last one wins), so all of them are handled here:
   * - "geogami:ve-exit": the "Back to game list" button in the VE's error banner
   *   (e.g. environment failed to load), as this page has no controls around the frame.
   * - VE_CLOSE_FRAME_MESSAGE: close the WebGL frame when the game is finished.
   *   Unlike the "closeWebGLFrame" socket event, this doesn't depend on the sockets
   *   still being in the game room (they are not after a reconnect).
   */
  @HostListener("window:message", ["$event"])
  onFrameMessage(event: MessageEvent) {
    if (event.data?.type === "geogami:ve-exit") {
      // posted by the WebGL template itself, i.e. our iframe's own window
      if (event.source !== this.veFrame?.nativeElement.contentWindow) return;
      this.navCtrl.navigateBack("play-game/play-game-list");
    } else if (event.data?.type === VE_CLOSE_FRAME_MESSAGE) {
      if (!this.isFromVEFrame(event.source as Window)) return;
      this.navCtrl.navigateRoot("/");
    }
  }

  /* the inner GeoGami app is a direct child of our WebGL frame (Vuplex iframe); parent is readable cross-origin */
  private isFromVEFrame(source: Window) {
    console.log("🚀 ~~~~~~ PlayingVirenvPage ~ isFromVEFrame ~ source:", source)
    const frameWindow = this.veFrame?.nativeElement.contentWindow;
    console.log("🚀 ~~~~~ PlayingVirenvPage ~ isFromVEFrame ~ frameWindow:", frameWindow)
    return !!frameWindow && !!source && source.parent === frameWindow;
  }
}
