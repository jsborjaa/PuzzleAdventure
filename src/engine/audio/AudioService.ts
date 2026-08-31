export class AudioService {
  private ctx: AudioContext;
  private static instance: AudioService;

  private constructor() {
    this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }

  public static getInstance(): AudioService {
    if (!AudioService.instance) AudioService.instance = new AudioService();
    return AudioService.instance;
  }

  public playPop() {
    this.blip('sine', 400, 600, 0.1, 0.3);
  }

  public playSnap() {
    this.blip('triangle', 800, 1200, 0.15, 0.3);
  }

  public playClick() {
    this.blip('square', 200, 200, 0.05, 0.1);
  }

  public playWin() {
    this.resume();
    const now = this.ctx.currentTime;
    [440, 554, 659, 880].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.2, now + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.5);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.5);
    });
  }

  private blip(type: OscillatorType, from: number, to: number, dur: number, vol: number) {
    this.resume();
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(from, this.ctx.currentTime);
    if (from !== to) osc.frequency.exponentialRampToValueAtTime(to, this.ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  private resume() {
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }
}
