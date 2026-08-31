export function formatTimer(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const two = (n: number) => (n < 10 ? `0${n}` : `${n}`);
  return hrs > 0 ? `${hrs}:${two(mins)}:${two(secs)}` : `${mins}:${two(secs)}`;
}

export class GameTimer {
  private elapsedMs = 0;
  private running = false;

  start(initialMs = 0) {
    this.elapsedMs = initialMs;
    this.running = true;
  }

  pause() {
    this.running = false;
  }

  tick(deltaMs: number) {
    if (!this.running) return;
    this.elapsedMs += deltaMs;
  }

  getElapsed() {
    return this.elapsedMs;
  }
}
