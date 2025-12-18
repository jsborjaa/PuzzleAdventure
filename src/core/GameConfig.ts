import 'phaser';
import { BootScene } from '../scenes/BootScene';

export const GameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'game-container',
  backgroundColor: '#2f3542',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  // Code-splitting: arrancar solo con BootScene y cargar el resto de escenas vía import()
  scene: [BootScene],
  physics: {
    default: 'arcade',
    arcade: {
      debug: false
    }
  }
};

