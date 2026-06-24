import {
  Component,
  OnInit,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
  ChangeDetectorRef,
} from "@angular/core";

import { PopoverComponent } from "src/app/popover/popover.component";
import { AlertController, PopoverController } from "@ionic/angular";
import { TranslateService } from "@ngx-translate/core";
import { AudioRecorderService } from "src/app/services/audio-recorder.service";
import { environment } from "src/environments/environment";

@Component({
  selector: "app-audio-recorder",
  templateUrl: "./audio-recorder.component.html",
  styleUrls: ["./audio-recorder.component.scss"],
})
export class AudioRecorderComponent implements OnInit, OnDestroy {
  @Input() audioSource: string;

  @Output() audioSourceChange: EventEmitter<any> = new EventEmitter<any>();
  recording = false;

  // Maximum recording length in seconds. Recording auto-stops once reached.
  readonly maxDurationSeconds = 30;
  // Seconds elapsed in the current recording, shown live so the user can see
  // the limit approaching.
  recordSeconds = 0;
  private recordInterval: any;

  constructor(
    public popoverController: PopoverController,
    private alertController: AlertController,
    private translate: TranslateService,
    private audioRecorder: AudioRecorderService,
    private changeDetectorRef: ChangeDetectorRef
  ) {}

  ngOnInit() {}

  ngOnDestroy() {
    this.clearRecordTimer();
  }

  startStopRec() {
    if (this.recording) {
      this.stopRecord();
    } else {
      this.startRecord();
    }
  }

  startRecord() {
    this.audioRecorder.start();
    this.recording = true;
    this.recordSeconds = 0;
    this.recordInterval = setInterval(() => {
      this.recordSeconds++;
      if (this.recordSeconds >= this.maxDurationSeconds) {
        this.stopRecord();
      }
    }, 1000);
  }

  stopRecord() {
    if (!this.recording) {
      return;
    }
    this.clearRecordTimer();
    this.recording = false;
    this.audioRecorder.stop().then(({ filename }) => {
      this.audioSource = `${environment.apiURL}/file/audio/${filename}`;
    // console.log(this.audioSource);
      this.audioSourceChange.emit(this.audioSource);
    });
  }

  private clearRecordTimer() {
    clearInterval(this.recordInterval);
  }

  async audioFromFile(event) {
    const file = event.target.files[0];
    // Reset so picking the same file again still triggers (change).
    event.target.value = "";
    if (!file) {
      return;
    }

    if (!(await this.isWithinDurationLimit(file))) {
      await this.presentTooLongAlert();
      return;
    }

    const { filename } = await this.audioRecorder.fromFile(file);

    this.audioSource = `${environment.apiURL}/file/audio/${filename}`;
    this.changeDetectorRef.detectChanges();
  // console.log(this.audioSource);
    this.audioSourceChange.emit(this.audioSource);
  }

  // Reads the file's duration via an off-screen audio element. Resolves true
  // when within the limit (or when the duration can't be determined, so we
  // don't block valid files we simply failed to probe).
  private isWithinDurationLimit(file: File): Promise<boolean> {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const audio = new Audio();
      audio.preload = "metadata";
      audio.onloadedmetadata = () => {
        URL.revokeObjectURL(url);
        resolve(
          !isFinite(audio.duration) || audio.duration <= this.maxDurationSeconds
        );
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(true);
      };
      audio.src = url;
    });
  }

  private async presentTooLongAlert() {
    const alert = await this.alertController.create({
      message: this.translate.instant("CreateGame.audioTooLong", {
        seconds: this.maxDurationSeconds,
      }),
      buttons: ["OK"],
    });
    await alert.present();
  }

  deleteAudio() {
    this.audioSource = undefined;
    this.audioSourceChange.emit(this.audioSource);
  }

  async showPopover(ev: any, text: string) {
  // console.log(ev);
    const popover = await this.popoverController.create({
      component: PopoverComponent,
      event: ev,
      translucent: true,
      componentProps: { text },
    });
    return await popover.present();
  }
}
