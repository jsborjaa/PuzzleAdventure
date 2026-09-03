import { Scene } from 'phaser';
import { LevelCatalog } from '../../data/LevelCatalog';
import { ensureCloudSession } from '../../data/cloud/auth';
import { setBootError, setBootProgress } from '../../ui/bootSplash';

export class BootScene extends Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    setBootProgress(0.2);
  }

  create() {
    setBootProgress(0.5);
    Promise.all([
      import('./MenuScene'),
      import('./GameScene'),
      ensureCloudSession(),
      LevelCatalog.getInstance().ensureLoaded(),
    ])
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
