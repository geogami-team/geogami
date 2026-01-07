import {
  Component,
  Input,
  ViewChild,
  AfterViewInit,
  OnChanges,
  SimpleChanges,
} from "@angular/core";

@Component({
  selector: "app-audio-player",
  templateUrl: "./audio-player.component.html",
  styleUrls: ["./audio-player.component.scss"]
})
export class AudioPlayerComponent implements AfterViewInit, OnChanges {
  @Input("audioSource") audioSource: string;

  @ViewChild("audio") audio;

  public playing = false;

  constructor() {}

  ngOnChanges(changes: SimpleChanges): void {
    if (this.audio != undefined) {
      this.loadAudio();
    }
  }

  ngAfterViewInit(): void {
    this.loadAudio();

    this.audio.nativeElement.addEventListener("ended", () => {
      this.loadAudio();
    });
  }

  loadAudio() {
    this.playing = false;
    (this.audio.nativeElement as HTMLAudioElement).load();
  }

  playPause() {
    if (this.playing) {
      (this.audio.nativeElement as HTMLAudioElement).pause();
      this.playing = false;
    } else {
      (this.audio.nativeElement as HTMLAudioElement).play();
      this.playing = true;
    }
  }
}
