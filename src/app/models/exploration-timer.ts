// Use a deadline so throttled browser callbacks still reflect elapsed time.
export class ExplorationTimer {
  remainingSeconds = 0;
  private interval: ReturnType<typeof setInterval>;

  get display(): string {
    const minutes = Math.floor(this.remainingSeconds / 60);
    const seconds = this.remainingSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  start(durationSeconds: number, onTick: () => void, onComplete: () => void): void {
    this.stop();
    if (!Number.isSafeInteger(durationSeconds) || durationSeconds <= 0) return;

    this.remainingSeconds = durationSeconds;
    const deadline = Date.now() + durationSeconds * 1000;
    this.interval = setInterval(() => {
      this.remainingSeconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (this.remainingSeconds === 0) {
        this.stop();
        onComplete();
      } else {
        onTick();
      }
    }, 1000);
  }

  stop(): void {
    clearInterval(this.interval);
    this.interval = undefined;
    this.remainingSeconds = 0;
  }
}
