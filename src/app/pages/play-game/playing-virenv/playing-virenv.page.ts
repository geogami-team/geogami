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
import { environment } from "src/environments/environment";

@Component({
  selector: "app-playing-virenv",
  templateUrl: "./playing-virenv.page.html",
  styleUrls: ["./playing-virenv.page.scss"],
})
export class PlayingVirenvPage implements OnInit {
  webGLURL: string = null;
  url: string = null;
  urlSafe: SafeResourceUrl;
  @ViewChild("veFrame") veFrame: ElementRef<HTMLIFrameElement>;

  constructor(
    private route: ActivatedRoute,
    private readonly domSanitizer: DomSanitizer,
    private navCtrl: NavController
  ) {}

  /* The VE's error banner (e.g. environment failed to load) has a "Back to game list"
     button, as this page has no controls around the frame. Its WebGL template posts
     "geogami:ve-exit" when it is pressed. */
  @HostListener("window:message", ["$event"])
  onVEMessage(event: MessageEvent) {
    if (event.data?.type !== "geogami:ve-exit") return;
    if (event.source !== this.veFrame?.nativeElement.contentWindow) return;
    this.navCtrl.navigateBack("play-game/play-game-list");
  }

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
}
