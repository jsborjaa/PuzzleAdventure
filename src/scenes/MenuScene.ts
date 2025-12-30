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
    const isMobile = width < 768;

    // Title
    this.add.text(width / 2, 60, 'MAPA DE NIVELES', {
      fontSize: isMobile ? '32px' : '42px',
      color: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    // Responsive Grid Configuration
    const nodeSize = 120;
    const gap = isMobile ? 140 : 150;
    const cols = isMobile ? Math.floor((width - 40) / gap) : 3;
    
    // Start Positions
    // Center grid horizontally
    const startX = (width - (cols - 1) * gap) / 2; 
    const startY = 150;

    // --- Main Levels ---
    let maxY = startY;

    LEVELS.forEach((level, index) => {
      const isUnlocked = this.progressService.isLevelUnlocked(level.id);
      
      const row = Math.floor(index / cols);
      const col = index % cols;

      const x = startX + col * gap;
      const y = startY + row * gap;

      this.createLevelNode(x, y, level, isUnlocked, nodeSize);
      
      if (y > maxY) maxY = y;
    });

    // --- Special Levels ---
    // On Desktop: Fixed to right. On Mobile: Below main grid.
    if (isMobile) {
        // Render below main levels
        const specialStartY = maxY + gap + 40;
        this.add.text(width / 2, specialStartY - 60, 'EVENTOS', {
            fontSize: '24px',
            color: '#ffe66d',
            fontStyle: 'bold'
        }).setOrigin(0.5);

        SPECIAL_LEVELS.forEach((level, idx) => {
            const x = width / 2; // Centered
            const y = specialStartY + idx * 160;
            this.createSpecialLevelNode(x, y, level, nodeSize);
            if (y > maxY) maxY = y;
        });
    } else {
        // Desktop: Fixed right sidebar
        const specialX = width - 140;
        const specialGapY = 170;
        
        SPECIAL_LEVELS.forEach((level, idx) => {
            const y = startY + idx * specialGapY;
            this.createSpecialLevelNode(specialX, y, level, nodeSize);
        });
    }

    // "Coming Soon" placeholder (after main levels)
    const lastIndex = LEVELS.length;
    const row = Math.floor(lastIndex / cols);
    const col = lastIndex % cols;
    const csX = startX + col * gap;
    const csY = startY + row * gap;
    
    const container = this.add.container(csX, csY);
    const bg = this.add.rectangle(0, 0, nodeSize, nodeSize, 0x2f3542);
    bg.setStrokeStyle(2, 0x555555);
    const txt = this.add.text(0, 0, 'Coming\nSoon', {
        fontSize: '18px',
        align: 'center',
        color: '#888'
    }).setOrigin(0.5);
    container.add([bg, txt]);
    
    // Check bounds for scrolling
    // We add some padding at bottom
    const bottomPadding = 100;
    const contentHeight = Math.max(maxY + bottomPadding, height);

    if (contentHeight > height) {
        this.cameras.main.setBounds(0, 0, width, contentHeight);
        this.setupScrolling();
    }

    // Reset Button
    const resetBtn = this.add.text(width - 20, 20, 'Reset', {
        fontSize: '12px',
        color: '#555'
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    resetBtn.setScrollFactor(0); // Always visible
    
    resetBtn.on('pointerdown', () => {
        if (confirm('¿Borrar todo el progreso?')) {
            this.progressService.resetProgress();
            this.scene.restart();
        }
    });

    // Max Level Indicator (Fixed at bottom of screen, not scrolling)
    const maxIndex = this.progressService.getHighestUnlockedIndex();
    const maxTxt = this.add.text(width / 2, height - 30, `Nivel Máximo: ${maxIndex + 1}`, {
        fontSize: '16px',
        color: '#888888'
    }).setOrigin(0.5);
    maxTxt.setScrollFactor(0); // UI element
  }

  private setupScrolling() {
    let isDragging = false;
    let dragStartY = 0;
    let camStartY = 0;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        isDragging = true;
        dragStartY = pointer.y;
        camStartY = this.cameras.main.scrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
        if (!isDragging) return;
        const diff = dragStartY - pointer.y;
        this.cameras.main.scrollY = camStartY + diff;
    });

    this.input.on('pointerup', () => {
        isDragging = false;
    });
    
    // Mouse wheel support
    this.input.on('wheel', (_p: any, _g: any, _dx: number, dy: number) => {
        this.cameras.main.scrollY += dy;
    });
  }

  private createLevelNode(x: number, y: number, level: LevelData, unlocked: boolean, size: number) {
    const container = this.add.container(x, y);

    // Background (Square Frame)
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
      
      // Store initial position for "click vs drag" check
      let downX = 0;
      let downY = 0;
      bg.on('pointerdown', (p: Phaser.Input.Pointer) => {
          downX = p.x;
          downY = p.y;
      });

      bg.on('pointerup', (p: Phaser.Input.Pointer) => {
          // Only trigger if it wasn't a drag (distance < 10)
          if (Phaser.Math.Distance.Between(downX, downY, p.x, p.y) < 10) {
              this.scene.start('GameScene', { levelId: level.id });
          }
      });

      // Hover effect
      bg.on('pointerover', () => bg.setStrokeStyle(4, 0xffe66d));
      bg.on('pointerout', () => bg.setStrokeStyle(4, 0x4ecdc4));
      
      // Level Number (Inside Box, Left)
      const offsetX = -size/2 + 20;
      const offsetY = -size/2 + 20;

      const numBgObj = this.add.circle(offsetX, offsetY, 15, 0xff6b6b);
      const numText = this.add.text(offsetX, offsetY, (LEVELS.indexOf(level) + 1).toString(), {
          fontSize: '16px',
          fontStyle: 'bold'
      }).setOrigin(0.5);

      // Difficulty Letter (Inside Box, Right)
      let diffLetter = 'S';
      let diffColor = 0xffa502; 
      
      if (level.difficulty <= 16) { diffLetter = 'C'; diffColor = 0x2ed573; } 
      else if (level.difficulty <= 36) { diffLetter = 'B'; diffColor = 0x1e90ff; } 
      else if (level.difficulty <= 64) { diffLetter = 'A'; diffColor = 0x9b59b6; } 
      
      const diffBgObj = this.add.circle(offsetX + 30, offsetY, 12, diffColor);
      const diffTextObj = this.add.text(offsetX + 30, offsetY, diffLetter, {
          fontSize: '14px',
          fontStyle: 'bold'
      }).setOrigin(0.5);

      container.add([numBgObj, numText, diffBgObj, diffTextObj]);

    } else {
      // Locked Icon
      const lockedText = this.add.text(0, 0, '?', {
        fontSize: '64px',
        color: '#555555'
      }).setOrigin(0.5);
      container.add(lockedText);
    }
  }

  private createSpecialLevelNode(x: number, y: number, level: LevelData, size: number) {
    const container = this.add.container(x, y);

    const bg = this.add.rectangle(0, 0, size, size, 0x2f3542);
    bg.setStrokeStyle(4, 0x4ecdc4);
    container.add(bg);

    const thumb = this.add.image(0, 0, level.imageKey);
    const scale = (size - 10) / Math.max(thumb.width, thumb.height);
    thumb.setScale(scale);
    container.add(thumb);

    bg.setInteractive({ useHandCursor: true });
    
    let downX = 0;
    let downY = 0;
    bg.on('pointerdown', (p: Phaser.Input.Pointer) => { downX = p.x; downY = p.y; });
    bg.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (Phaser.Math.Distance.Between(downX, downY, p.x, p.y) < 10) {
            this.scene.start('GameScene', { levelId: level.id });
        }
    });

    bg.on('pointerover', () => bg.setStrokeStyle(4, 0xffe66d));
    bg.on('pointerout', () => bg.setStrokeStyle(4, 0x4ecdc4));

    // Difficulty badge
    let diffLabel = 'S';
    if (level.difficulty >= 1000) diffLabel = 'SSSS';
    else if (level.difficulty >= 500) diffLabel = 'SSS';
    else if (level.difficulty >= 200) diffLabel = 'SS';

    const diffBg = this.add.rectangle(0, size/2 - 10, 46, 18, 0xffa502, 0.9);
    diffBg.setStrokeStyle(1, 0x000000, 0.4);
    const diffText = this.add.text(0, size/2 - 10, diffLabel, {
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
    container.add(title);
  }
}
