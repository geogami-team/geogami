import {
  Component,
  Input,
  ViewChild,
  AfterViewInit,
  OnChanges,
  OnDestroy,
  SimpleChanges,
} from "@angular/core";

@Component({
  selector: "app-audio-player",
  templateUrl: "./audio-player.component.html",
  styleUrls: ["./audio-player.component.scss"]
})
export class AudioPlayerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input("audioSource") audioSource: string;

  // When true, the audio starts playing on its own shortly after the task is
  // shown, so the player no longer has to press the play button first.
  @Input("autoPlay") autoPlay = false;

  // Delay (ms) before auto-play kicks in once the task is initialised.
  @Input("autoPlayDelay") autoPlayDelay = 1500;

  @ViewChild("audio") audio;

  public playing = false;

  private autoPlayTimer: any;

  constructor() {}

  ngOnChanges(changes: SimpleChanges): void {
    if (this.audio != undefined) {
      this.loadAudio();
      this.scheduleAutoPlay();
    }
  }

  ngAfterViewInit(): void {
    this.loadAudio();
    this.scheduleAutoPlay();

    this.audio.nativeElement.addEventListener("ended", () => {
      // Reset to the start so the user can replay manually, but do NOT re-arm
      // auto-play here — the instruction should play once, not on a loop.
      this.loadAudio();
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.autoPlayTimer);
  }

  loadAudio() {
    clearTimeout(this.autoPlayTimer);
    this.playing = false;
    (this.audio.nativeElement as HTMLAudioElement).load();
  }

  // Auto-plays the audio once, shortly after the task is shown. Only called on
  // init / when the audio source changes, never when playback ends.
  private scheduleAutoPlay() {
    clearTimeout(this.autoPlayTimer);
    if (this.autoPlay && this.audioSource != undefined) {
      this.autoPlayTimer = setTimeout(() => this.startPlayback(), this.autoPlayDelay);
    }
  }

  private startPlayback() {
    const player = this.audio.nativeElement as HTMLAudioElement;
    const playPromise = player.play();
    this.playing = true;

    // Browsers may block programmatic playback (autoplay policy); fall back to
    // the manual play button if the promise rejects.
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        this.playing = false;
      });
    }
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
