import { Scene } from 'phaser';
import { MenuView } from '../../ui/MenuView';

export class MenuScene extends Scene {
  private menu?: MenuView;

  constructor() {
    super('MenuScene');
  }

  create() {
    this.cameras.main.setBackgroundColor('#6ec8ff');
    const host = document.getElementById('ui-layer');
    if (!host) return;
    this.menu = new MenuView(host, (levelId) => {
      this.menu?.destroy();
      this.scene.start('GameScene', { levelId });
    });
  }

  shutdown() {
    this.menu?.destroy();
    const host = document.getElementById('ui-layer');
    if (host) host.innerHTML = '';
  }
}
