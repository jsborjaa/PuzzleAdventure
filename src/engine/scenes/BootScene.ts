import { Scene } from 'phaser';
import { LEVELS, SPECIAL_LEVELS, withDevCacheBust } from '../../data/Levels';
import { setBootError, setBootProgress } from '../../ui/bootSplash';

export class BootScene extends Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    this.load.on('progress', (value: number) => setBootProgress(value * 0.85));
    LEVELS.forEach((level) => this.load.image(level.imageKey, withDevCacheBust(level.imageUrl)));
    SPECIAL_LEVELS.forEach((level) => this.load.image(level.imageKey, withDevCacheBust(level.imageUrl)));
  }

  create() {
    setBootProgress(0.9);
    Promise.all([import('./MenuScene'), import('./GameScene')])
      .then(([menuMod, gameMod]) => {
        if (!this.scene.get('MenuScene')) this.scene.add('MenuScene', menuMod.MenuScene, false);
        if (!this.scene.get('GameScene')) this.scene.add('GameScene', gameMod.GameScene, false);
        setBootProgress(1);
        this.scene.start('MenuScene');
      })
      .catch((err) => {
        console.error('Failed to load scenes', err);
        setBootError();
      });
  }
}
