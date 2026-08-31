import { Scene } from 'phaser';
import { LEVELS, SPECIAL_LEVELS, withDevCacheBust } from '../../data/Levels';
import { t } from '../../i18n';

export class BootScene extends Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    LEVELS.forEach((level) => this.load.image(level.imageKey, withDevCacheBust(level.imageUrl)));
    SPECIAL_LEVELS.forEach((level) => this.load.image(level.imageKey, withDevCacheBust(level.imageUrl)));
  }

  create() {
    const { width, height } = this.scale;
    const loadingText = this.add
      .text(width / 2, height / 2, t('boot.loading'), {
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    Promise.all([import('./MenuScene'), import('./GameScene')])
      .then(([menuMod, gameMod]) => {
        if (!this.scene.get('MenuScene')) this.scene.add('MenuScene', menuMod.MenuScene, false);
        if (!this.scene.get('GameScene')) this.scene.add('GameScene', gameMod.GameScene, false);
        loadingText.destroy();
        this.scene.start('MenuScene');
      })
      .catch((err) => {
        console.error('Failed to load scenes', err);
        loadingText.setText(t('boot.error'));
      });
  }
}
