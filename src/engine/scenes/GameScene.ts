import { Scene } from 'phaser';
import { GameRuntime } from '../GameRuntime';

export class GameScene extends Scene {
  private runtime?: GameRuntime;

  constructor() {
    super('GameScene');
  }

  create(data: { levelId: string; forceReplay?: boolean }) {
    this.runtime = new GameRuntime(this, data);
    void this.runtime.start();
    this.events.once('shutdown', () => this.runtime?.destroy());
  }

  update(time: number, delta: number) {
    this.runtime?.update(time, delta);
  }
}
