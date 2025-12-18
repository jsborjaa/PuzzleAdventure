import { Scene } from 'phaser';
import { LEVELS, LevelData, SPECIAL_LEVELS } from '../core/Levels';
import { ProgressService } from '../services/ProgressService';

export class MenuScene extends Scene {
  private progressService: ProgressService;

  constructor() {
    super('MenuScene');
    this.progressService = ProgressService.getInstance();
  }

  create() {
    console.log('MenuScene created');
    const { width, height } = this.scale;

    // Title
    this.add.text(width / 2, 60, 'MAPA DE NIVELES', {
      fontSize: '42px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Level Grid Container
    // Center the grid
    const gridWidth = 600;
    const startX = (width - gridWidth) / 2 + 100; // Offset for centering
    const startY = 150;
    const gap = 150;
    const cols = 3;
    const specialX = width - 140;
    const specialGapY = 170;

    // Add auto-unlock for "Catch Up" logic
    // If we have more levels available than the map currently shows as unlocked?
    // No, the map renders based on ProgressService state.
    // But we can check if we should show "Coming Soon" or if we can actually play.
    
    LEVELS.forEach((level, index) => {
      // Check unlock status using the new robust integer check
      const isUnlocked = this.progressService.isLevelUnlocked(level.id);
      
      const row = Math.floor(index / cols);
      const col = index % cols;

      const x = startX + col * gap;
      const y = startY + row * gap;

      this.createLevelNode(x, y, level, isUnlocked);
    });

    // Specials (fijos a la derecha)
    SPECIAL_LEVELS.forEach((level, idx) => {
      const y = startY + idx * specialGapY;
      this.createSpecialLevelNode(specialX, y, level);
    });

    // "Coming Soon" placeholder
    const lastIndex = LEVELS.length;
    const row = Math.floor(lastIndex / cols);
    const col = lastIndex % cols;
    const x = startX + col * gap;
    const y = startY + row * gap;

    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 120, 120, 0x2f3542);
    bg.setStrokeStyle(2, 0x555555); // Dimmer border
    const txt = this.add.text(0, 0, 'Coming\nSoon', {
        fontSize: '18px',
        align: 'center',
        color: '#888'
    }).setOrigin(0.5);
    container.add([bg, txt]);
    
    // Reset Button (Moved to Top Right to avoid accidental clicks)
    const resetBtn = this.add.text(width - 20, 20, 'Reset', {
        fontSize: '12px',
        color: '#555'
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    
    resetBtn.on('pointerdown', () => {
        if (confirm('¿Borrar todo el progreso?')) {
            this.progressService.resetProgress();
            this.scene.restart();
        }
    });

    // DEBUG: Show Max Completed Level
    const maxIndex = this.progressService.getHighestUnlockedIndex();
    this.add.text(width / 2, height - 30, `Nivel Máximo Desbloqueado: ${maxIndex + 1}`, {
        fontSize: '16px',
        color: '#888888'
    }).setOrigin(0.5);
  }

  private createLevelNode(x: number, y: number, level: LevelData, unlocked: boolean) {
    const container = this.add.container(x, y);

    // Background (Square Frame)
    const size = 120;
    const bg = this.add.rectangle(0, 0, size, size, 0x2f3542);
    bg.setStrokeStyle(4, unlocked ? 0x4ecdc4 : 0x555555);
    
    container.add(bg);

    if (unlocked) {
      // Thumbnail
      const thumb = this.add.image(0, 0, level.imageKey);
      // Scale to fit
      const scale = (size - 10) / Math.max(thumb.width, thumb.height);
      thumb.setScale(scale);
      container.add(thumb);

      // Play Button Overlay behavior
      bg.setInteractive({ useHandCursor: true });
      bg.on('pointerdown', () => {
        this.scene.start('GameScene', { levelId: level.id });
      });

      // Hover effect
      bg.on('pointerover', () => bg.setStrokeStyle(4, 0xffe66d));
      bg.on('pointerout', () => bg.setStrokeStyle(4, 0x4ecdc4));
      
      // Level Number (Inside Box, Left)
      const numBg = this.add.circle(20, 40, 15, 0xff6b6b);
      const numText = this.add.text(20, 40, (LEVELS.indexOf(level) + 1).toString(), {
          fontSize: '16px',
          fontStyle: 'bold'
      }).setOrigin(0.5);

      // Difficulty Letter (Inside Box, Right)
      let diffLetter = 'S';
      let diffColor = 0xffa502; 
      
      if (level.difficulty <= 16) { diffLetter = 'C'; diffColor = 0x2ed573; } 
      else if (level.difficulty <= 36) { diffLetter = 'B'; diffColor = 0x1e90ff; } 
      else if (level.difficulty <= 64) { diffLetter = 'A'; diffColor = 0x9b59b6; } 
      
      const diffBg = this.add.circle(50, 40, 12, diffColor);
      const diffText = this.add.text(50, 40, diffLetter, {
          fontSize: '14px',
          fontStyle: 'bold'
      }).setOrigin(0.5);

      container.add([numBg, numText, diffBg, diffText]);

    } else {
      // Locked Icon
      const lockedText = this.add.text(0, 0, '?', {
        fontSize: '64px',
        color: '#555555'
      }).setOrigin(0.5);
      container.add(lockedText);
    }
  }

  private createSpecialLevelNode(x: number, y: number, level: LevelData) {
    const container = this.add.container(x, y);
    container.setScrollFactor(0);

    const size = 120;
    const bg = this.add.rectangle(0, 0, size, size, 0x2f3542);
    bg.setStrokeStyle(4, 0x4ecdc4);
    container.add(bg);

    const thumb = this.add.image(0, 0, level.imageKey);
    const scale = (size - 10) / Math.max(thumb.width, thumb.height);
    thumb.setScale(scale);
    container.add(thumb);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerdown', () => {
      this.scene.start('GameScene', { levelId: level.id });
    });
    bg.on('pointerover', () => bg.setStrokeStyle(4, 0xffe66d));
    bg.on('pointerout', () => bg.setStrokeStyle(4, 0x4ecdc4));

    // Difficulty badge (supports SS / SSS / SSSS)
    let diffLabel = 'S';
    if (level.difficulty >= 1000) diffLabel = 'SSSS';
    else if (level.difficulty >= 500) diffLabel = 'SSS';
    else if (level.difficulty >= 200) diffLabel = 'SS';

    const diffBg = this.add.rectangle(0, 50, 46, 18, 0xffa502, 0.9);
    diffBg.setStrokeStyle(1, 0x000000, 0.4);
    const diffText = this.add.text(0, 50, diffLabel, {
      fontSize: '12px',
      fontStyle: 'bold',
      color: '#fff'
    }).setOrigin(0.5);

    container.add([diffBg, diffText]);

    // Title below
    const title = this.add.text(0, size / 2 + 20, level.title, {
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);
    title.setScrollFactor(0);
    container.add(title);
  }
}
