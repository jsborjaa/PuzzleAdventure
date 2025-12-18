import { Scene } from 'phaser';
import { LEVELS, SPECIAL_LEVELS } from '../core/Levels';

export class BootScene extends Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Load the "Map" background or assets if any
    
    // Load all level images defined in configuration
    LEVELS.forEach(level => {
        this.load.image(level.imageKey, level.imageUrl);
    });

    // Load special level images
    SPECIAL_LEVELS.forEach(level => {
        this.load.image(level.imageKey, level.imageUrl);
    });
  }

  create() {
    console.log('BootScene created. Assets loaded.');

    // Code-splitting: cargar escenas bajo demanda (se generan chunks separados en build)
    const { width, height } = this.scale;
    const loadingText = this.add.text(width / 2, height / 2, 'Cargando...', {
      fontSize: '24px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    Promise.all([
      import('./MenuScene'),
      import('./GameScene'),
      import('./UIScene'),
    ])
      .then(([menuMod, gameMod, uiMod]) => {
        // Registrar escenas si aún no existen
        if (!this.scene.get('MenuScene')) {
          this.scene.add('MenuScene', menuMod.MenuScene, false);
        }
        if (!this.scene.get('GameScene')) {
          this.scene.add('GameScene', gameMod.GameScene, false);
        }
        if (!this.scene.get('UIScene')) {
          this.scene.add('UIScene', uiMod.UIScene, false);
        }

        loadingText.destroy();
        this.scene.start('MenuScene');
      })
      .catch((err) => {
        console.error('Failed to load scenes', err);
        loadingText.setText('Error al cargar. Reintenta.');
      });
  }
}
