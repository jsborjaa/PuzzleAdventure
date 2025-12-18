import { Scene } from 'phaser';
import { PuzzleBoard } from '../game/board/PuzzleBoard';
import { ToolManager } from '../game/tools/ToolManager';
import { CameraController } from '../game/input/CameraController';
import { AreaTool } from '../game/tools/AreaTool';
import { HintTool } from '../game/tools/HintTool';
import { AudioService } from '../services/AudioService';
import { getLevelById } from '../core/Levels';
import { ProgressService, GameSession } from '../services/ProgressService';
import { TimerStore } from '../game/timer/TimerStore';
import { PocketManager } from '../game/pocket/PocketManager';
import { CameraTool } from '../game/tools/CameraTool';
import { Piece } from '../objects/Piece';
import { PocketFocusMode } from '../game/pocket/PocketFocusMode';

export class GameScene extends Scene {
  private puzzleBoard!: PuzzleBoard;
  private toolManager!: ToolManager;
  private cameraController!: CameraController;
  private pocketFocusMode?: PocketFocusMode;
  
  private currentLevelId: string = '';
  private isReplayMode: boolean = false; 
  private revealTimer?: Phaser.Time.TimerEvent;
  private isSpecialLevel: boolean = false;
  private elapsedMs: number = 0;
  private lastBroadcastTime: number = 0;
  private visibilityPersistHandler?: () => void;
  private timerStore = TimerStore.getInstance();
  private pocketManager = new PocketManager();
  private activePocketIndex: number = 0;

  constructor() {
    super('GameScene');
  }

  create(data: { levelId: string, forceReplay?: boolean }) {
    const levelId = data.levelId || 'level_1';
    const forceReplay = data.forceReplay || false;
    const levelConfig = getLevelById(levelId);
    
    if (!levelConfig) {
        console.error('Level config not found!');
        this.scene.start('MenuScene');
        return;
    }

    this.currentLevelId = levelId;
    this.isSpecialLevel = !!levelConfig.eventType;
    this.isReplayMode = false;

    console.log(`GameScene: Starting ${levelId}`);

    // 1. Setup Managers
    this.puzzleBoard = new PuzzleBoard(this);
    this.puzzleBoard.initialize(levelId);

    this.toolManager = new ToolManager(this);
    // Register Tools
    this.toolManager.addTool('AREA_3X3', new AreaTool(this, this.puzzleBoard, 3));
    this.toolManager.addTool('AREA_4X4', new AreaTool(this, this.puzzleBoard, 4));
    this.toolManager.addTool('HINT', new HintTool(this, this.puzzleBoard));
    this.toolManager.addTool('POCKET_CAMERA', new CameraTool(this, this.puzzleBoard, 4, ({ pieceLayout, imageKey, crop, solvedIds }) => {
        this.pocketManager.saveTemplate(this.activePocketIndex, {
            pieceLayout,
            capturedAt: Date.now(),
            imageKey,
            crop,
            solvedIds,
        });
        const snap = this.pocketManager.snapshot();
        this.events.emit('pocket-template-captured', { pocketIndex: this.activePocketIndex, snapshot: snap });
        this.events.emit('pocket-updated', snap);
    }));

    this.cameraController = new CameraController(this);

    // 2. Load State
    const progressService = ProgressService.getInstance();
    const isSpecial = !!levelConfig.eventType;
    const session: GameSession | null = isSpecial
      ? progressService.getSpecialSession(levelId)
      : progressService.getSession();
    const isCompleted = isSpecial ? false : progressService.isLevelCompleted(levelId);
    
    let loadFromSession = false;
    let loadSolved = false;

    if (session && session.levelId === levelId && !forceReplay) {
        loadFromSession = true;
        console.log('Resuming saved session...');
    } else if (isCompleted && !forceReplay) {
        loadSolved = true;
        this.isReplayMode = true;
        console.log('Loading completed level (view only)...');
    } else {
        console.log('Starting fresh game...');
    }

    // Tiempo:
    // - Solo se restaura si estamos reanudando sesión
    // - Si es fresh/replay, debe arrancar en 0 y limpiar cualquier timer persistido
    if (loadFromSession) {
        const timerSnapshot = this.timerStore.restore(levelId);
        const sessionElapsed = session?.elapsedMs ?? 0;
        const restoredElapsed = timerSnapshot?.elapsedMs ?? 0;
        this.elapsedMs = Math.max(sessionElapsed, restoredElapsed);
    } else {
        this.elapsedMs = 0;
        this.timerStore.clear(levelId);
    }

    // 3. Create Pieces via Board
    this.puzzleBoard.createPieces(levelId, loadFromSession, loadSolved, session?.pieces);
    this.pocketManager.attach(this.puzzleBoard, this, levelId);
    // Si no estamos reanudando una sesión, este nivel se considera "fresh/replay" y los bolsillos
    // no deben arrastrar piezas de una run anterior.
    if (!loadFromSession) {
        this.pocketManager.clearAll();
        this.events.emit('pocket-updated', this.pocketManager.snapshot());
    } else {
        // Solo esconder piezas si realmente estamos reanudando (persistencia de bolsillo válida)
        this.pocketManager.applyHiddenPiecesOnLoad();
    }

    // Modo enfoque del bolsillo sobre el tablero principal
    this.pocketFocusMode = new PocketFocusMode(this, this.puzzleBoard, this.pocketManager);

    // Prevent context menu on right click
    this.input.mouse?.disableContextMenu();

    // 4. UI & Events
    // Importante: registrar handlers ANTES de lanzar la UI, para que el primer click no se pierda.
    this.setupEventHandlers();
    this.scene.launch('UIScene');
    this.visibilityPersistHandler = () => {
        if (document.hidden) {
            this.timerStore.persist(true);
        }
    };
    document.addEventListener('visibilitychange', this.visibilityPersistHandler);
    window.addEventListener('beforeunload', this.visibilityPersistHandler);

    // Restore Reveal State
    if (loadSolved && !isSpecial) {
        this.createResetButton();
    } else {
        if (session && session.levelId === this.currentLevelId && session.isRevealActive) {
            const guide = this.puzzleBoard.getContainer().getByName('guide_image') as Phaser.GameObjects.Image;
            if (guide) guide.setAlpha(0.3);
        }
    }

    // Emit init event
    this.events.emit('game-started', this.puzzleBoard.getPieces().length);

    // Check win immediately if loaded from session
    if (loadFromSession) {
        this.time.delayedCall(500, () => {
            this.checkWinCondition();
        });
    }

    // Start timer only for active play
    if (!this.isReplayMode) {
        this.startTimer();
    } else {
        this.timerStore.clear(this.currentLevelId);
    }
  }

  private setupEventHandlers() {
      // Game Logic Events
      this.events.on('piece-placed', this.onPiecePlaced, this);
      this.events.on('request-save', this.saveGameSession, this);
      this.events.on('timer-tick', () => this.broadcastTimer());
      this.events.on('piece-drag-end', this.onPieceDragEnd, this);
      
      // Tool Events (Mapped from UI)
      this.events.on('activate-area-drag', () => {
          this.toolManager.activateTool('AREA_3X3');
          this.events.emit('area-mode-changed', true);
      });

      this.events.on('deactivate-area-drag', () => {
          this.toolManager.activateTool('NONE');
          this.events.emit('area-mode-changed', false);
      });

      this.events.on('activate-sarea-drag', () => {
          this.toolManager.activateTool('AREA_4X4');
          this.events.emit('sarea-mode-changed', true);
      });

      this.events.on('deactivate-sarea-drag', () => {
          this.toolManager.activateTool('NONE');
          this.events.emit('sarea-mode-changed', false);
      });

      this.events.on('activate-hint-drag', () => {
          this.toolManager.activateTool('HINT');
          this.events.emit('hint-mode-changed', true);
      });

      this.events.on('deactivate-hint-drag', () => {
          this.toolManager.activateTool('NONE');
          this.events.emit('hint-mode-changed', false);
      });

      // Legacy Hint Toggle (if still used by direct click logic?)
      // The UI now uses drag events mostly, but let's keep the toggle handler just in case
      // although UI seems to use setupDragTool. 
      this.events.on('toggle-hint-mode', (isActive: boolean) => {
          if (isActive) this.toolManager.activateTool('HINT');
          else this.toolManager.activateTool('NONE');
      });

      // Reveal Logic
      this.events.on('show-guide', this.onShowGuide, this);
      this.events.on('toggle-reveal-permanent', this.toggleRevealPermanent, this);
      this.events.on('toggle-reveal-temp', this.toggleRevealTemporary, this);

      // Pocket events from UIScene
      this.events.on('pocket-open', (idx: number) => {
          this.activePocketIndex = idx;
          this.pocketFocusMode?.open(idx);
          this.toolManager.activateTool('NONE');
          // Mantener cámara habilitada en modo bolsillo para poder hacer zoom/pan como en el tablero principal.
          this.cameraController.setEnabled(true);
      });
      this.events.on('pocket-close', () => {
          this.pocketFocusMode?.close();
          this.cameraController.setEnabled(true);
      });
      this.events.on('pocket-retrieve-all', (idx: number) => {
          // Si estamos en modo bolsillo, estas piezas "salen" del bolsillo y deben aparecer al cerrar
          // (sin quedar atrapadas en el baseline restore).
          const wasOpen = this.pocketFocusMode?.isOpen() && idx === this.activePocketIndex;
          const releasedIds = wasOpen ? this.pocketManager.getPocketState(idx).pieces.map(p => p.pieceId) : [];

          this.pocketManager.retrieveAll(idx);
          if (wasOpen) {
              releasedIds.forEach((pieceId) => this.pocketFocusMode?.markPieceReleasedToWorld(pieceId));
              this.pocketFocusMode?.refresh();
          }
          this.events.emit('pocket-updated', this.pocketManager.snapshot());
      });
      this.events.on('pocket-retrieve-piece', ({ pocketIndex, pieceId }: { pocketIndex: number, pieceId: number }) => {
          const wasOpen = this.pocketFocusMode?.isOpen() && pocketIndex === this.activePocketIndex;
          this.pocketManager.retrievePiece(pocketIndex, pieceId);
          if (wasOpen) {
              this.pocketFocusMode?.markPieceReleasedToWorld(pieceId);
              this.pocketFocusMode?.refresh();
          }
          this.events.emit('pocket-updated', this.pocketManager.snapshot());
      });
      this.events.on('pocket-auto-insert', (idx: number) => {
          this.pocketManager.autoInsertIfSolved(idx);
          this.events.emit('pocket-updated', this.pocketManager.snapshot());
      });
      this.events.on('pocket-place-piece', ({ pieceId, pocketIndex }: { pieceId: number, pocketIndex: number }) => {
          this.pocketManager.placePieceFromPocket(pocketIndex, pieceId);
          this.events.emit('pocket-updated', this.pocketManager.snapshot());
      });
      this.events.on('pocket-rotate-piece', ({ pocketIndex, pieceId }: { pocketIndex: number, pieceId: number }) => {
          this.pocketManager.rotatePiece(pocketIndex, pieceId);
          this.events.emit('pocket-updated', this.pocketManager.snapshot());
      });
      this.events.on('activate-pocket-camera', () => {
          // Restricción: 1 foto por bolsillo hasta resolver completamente el área fotografiada
          if (!this.pocketManager.canCaptureTemplate(this.activePocketIndex)) {
              this.events.emit('pocket-camera-blocked', { pocketIndex: this.activePocketIndex });
              return;
          }
          this.toolManager.activateTool('POCKET_CAMERA');
      });
      this.events.on('request-pocket-snapshot', () => {
          this.events.emit('pocket-updated', this.pocketManager.snapshot());
      });
      this.events.on('cancel-pocket-camera', () => {
          this.toolManager.activateTool('NONE');
          this.toolManager.activateTool('NONE'); // extra ensure
      });

      // Shutdown
      this.events.on('shutdown', this.shutdown, this);
  }

  private shutdown() {
      if (!this.isReplayMode) {
          this.saveGameSession();
      }
      this.toolManager.destroy();
      this.cameraController.destroy();
      this.stopTimer(true);
      this.detachVisibilityHandlers();
      this.events.off('piece-placed');
      this.events.off('request-save');
      this.events.off('activate-area-drag');
      this.events.off('deactivate-area-drag');
      this.events.off('activate-sarea-drag');
      this.events.off('deactivate-sarea-drag');
      this.events.off('activate-hint-drag');
      this.events.off('deactivate-hint-drag');
      this.events.off('show-guide');
      this.events.off('toggle-reveal-permanent');
      this.events.off('toggle-reveal-temp');
      this.events.off('timer-tick');
      this.events.off('piece-drag-end');
      this.events.off('pocket-open');
      this.events.off('pocket-close');
      this.events.off('pocket-retrieve-all');
      this.events.off('pocket-auto-insert');
      this.events.off('activate-pocket-camera');
      this.events.off('request-pocket-snapshot');
      this.events.off('cancel-pocket-camera');
      if (this.revealTimer) this.revealTimer.remove();
  }

  private onPiecePlaced() {
      this.saveGameSession();
      this.checkWinCondition();
      
      const pieces = this.puzzleBoard.getPieces();
      const solvedCount = pieces.filter(p => p.isSolved).length;
      this.events.emit('progress-sync', solvedCount);
  }

  private onPieceDragEnd(piece?: Piece) {
      if (!piece) return;
      const uiScene = this.scene.get('UIScene') as any;
      const pointer = this.input.activePointer;

      if (this.pocketFocusMode?.isOpen()) {
          // Drop sobre "Puzzle" => devolver ESTA pieza al tablero principal
          const overPuzzle = uiScene?.isPointerOverPuzzle?.(pointer);
          if (overPuzzle) {
              const fromPocketIdx = this.activePocketIndex;
              const pieceId = this.pocketManager.getPieceIdIfInPocket(fromPocketIdx, piece);
              if (pieceId === null) return;
              // devolverla donde está actualmente (no en la posición vieja del stash)
              this.pocketManager.updateLastWorldPos(fromPocketIdx, pieceId, { x: piece.x, y: piece.y, angle: piece.angle });
              this.pocketManager.releasePieceToWorld(fromPocketIdx, pieceId);
              // Mantener visible mientras el modo bolsillo sigue abierto
              this.pocketFocusMode.markPieceReleasedToWorld(pieceId);
              this.events.emit('pocket-updated', this.pocketManager.snapshot());
              this.pocketFocusMode.refresh();
              return;
          }

          // Drop sobre B1/B2/B3 => transfer entre bolsillos
          const pocketIdx = uiScene?.isPointerOverPocket?.(pointer);
          if (pocketIdx === null || pocketIdx === undefined) return;
          const fromPocketIdx = this.activePocketIndex;
          const toPocketIdx = pocketIdx;
          if (toPocketIdx === fromPocketIdx) return;
          const pieceId = this.pocketManager.getPieceIdIfInPocket(fromPocketIdx, piece);
          if (pieceId === null) return;
          const ok = this.pocketManager.transferPiece(fromPocketIdx, toPocketIdx, pieceId);
          if (ok) {
              this.events.emit('pocket-updated', this.pocketManager.snapshot());
              this.pocketFocusMode.refresh();
          }
          return;
      }

      const pocketIdx = uiScene?.isPointerOverPocket?.(pointer);
      if (pocketIdx === null || pocketIdx === undefined) return;

      // Caso normal: desde tablero principal hacia un bolsillo
      this.activePocketIndex = pocketIdx;
      const ok = this.pocketManager.stashPiece(piece, pocketIdx);
      if (ok) {
          this.events.emit('pocket-updated', this.pocketManager.snapshot());
      }
  }

  private saveGameSession() {
      if (this.isReplayMode) return;
      const elapsed = this.timerStore.getElapsed();
      this.elapsedMs = elapsed;

      const container = this.puzzleBoard.getContainer();
      const guide = container ? container.getByName('guide_image') as Phaser.GameObjects.Image : null;
      const isRevealActive = guide ? guide.alpha > 0 : false;
      
      const pieces = this.puzzleBoard.getPieces();

      const sessionData = {
          levelId: this.currentLevelId,
          pieces: pieces.map((p, i) => ({
              id: i, // Assumption: pieces are in same order as created
              x: p.x,
              y: p.y,
              angle: p.angle,
              isSolved: p.isSolved
          })),
          isRevealActive: isRevealActive,
          lastUpdated: Date.now(),
          elapsedMs: elapsed
      };
      const progressService = ProgressService.getInstance();
      if (this.isSpecialLevel) {
          progressService.saveSpecialSession(sessionData);
      } else {
          progressService.saveSession(sessionData);
      }
      this.timerStore.persist(true);
  }

  private checkWinCondition() {
    const pieces = this.puzzleBoard.getPieces();
    const allSolved = pieces.every(p => p.isSolved);
    
    if (allSolved) {
        console.log('YOU WIN!');
        AudioService.getInstance().playWin();
        this.cameras.main.flash(1000, 255, 255, 255);
        this.stopTimer(true);

        if (!this.isReplayMode && !this.isSpecialLevel) {
            this.handleLevelComplete();
            ProgressService.getInstance().clearSession();
            this.timerStore.clear(this.currentLevelId);
            this.pocketManager.clearAll();
        } else {
            this.createWinPopup();
        }
    }
  }

  private handleLevelComplete() {
    const currentNum = parseInt(this.currentLevelId.replace('level_', ''), 10);
    const currentIndex = currentNum - 1;

    ProgressService.getInstance().completeLevel(currentIndex);
    console.log(`Completed Level ${currentNum}. Next level unlocked.`);
    this.createWinPopup();
  }

  // Expose pieces for UI (compat con UIScene)
  public getPieces() {
    return this.puzzleBoard ? this.puzzleBoard.getPieces() : [];
  }

  /** UI helper: permite saber si el bolsillo puede tomar una nueva foto (ver restricción 1-foto). */
  public canTakePocketPhoto(pocketIdx: number): boolean {
    return this.pocketManager.canCaptureTemplate(pocketIdx);
  }

  // Reveal Logic Helpers
  private onShowGuide(visible: boolean) {
      const guide = this.puzzleBoard.getContainer().getByName('guide_image') as Phaser.GameObjects.Image;
      if (guide) guide.setAlpha(visible ? 0.4 : 0);
  }

  private toggleRevealPermanent() {
      const guide = this.puzzleBoard.getContainer().getByName('guide_image') as Phaser.GameObjects.Image;
      if (guide) {
          const current = guide.alpha;
          const newAlpha = current > 0 ? 0 : 0.3;
          guide.setAlpha(newAlpha);
          // Consume only when turning ON
          if (newAlpha > 0 && current <= 0) {
              this.events.emit('powerup-used', 'reveal_perm');
          }
          this.saveGameSession();
      }
  }

  private toggleRevealTemporary() {
      const guide = this.puzzleBoard.getContainer().getByName('guide_image') as Phaser.GameObjects.Image;
      if (guide) {
          // If already visible (temp active), ignore to avoid double-consume
          if (guide.alpha <= 0) {
              guide.setAlpha(0.3);
              this.events.emit('reveal-temp-changed', true);
              this.events.emit('powerup-used', 'reveal_temp');
              
              if (this.revealTimer) this.revealTimer.remove();
              
              this.revealTimer = this.time.delayedCall(20000, () => {
                  guide.setAlpha(0);
                  this.events.emit('reveal-temp-changed', false);
              });
          }
      }
  }

  private createResetButton() {
      const { width, height } = this.scale;
      const btn = this.add.text(width/2, height - 80, 'DESARMAR Y JUGAR', {
          fontSize: '24px',
          fontStyle: 'bold',
          color: '#ffffff',
          backgroundColor: '#ff6b6b',
          padding: { x: 20, y: 10 }
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .setDepth(1000);

      btn.on('pointerdown', () => {
          ProgressService.getInstance().clearSession();
          this.timerStore.clear(this.currentLevelId);
          this.scene.restart({ levelId: this.currentLevelId, forceReplay: true });
      });
  }

  private createWinPopup() {
    const { width, height } = this.scale;

    const overlay = this.add.rectangle(width/2, height/2, width, height, 0x000000, 0.7);
    overlay.setInteractive(); 
    overlay.setDepth(1000);

    const popup = this.add.container(width/2, height/2);
    popup.setDepth(1001);

    const bg = this.add.rectangle(0, 0, 400, 300, 0x2f3542);
    bg.setStrokeStyle(4, 0x4ecdc4);
    
    const title = this.add.text(0, -80, '¡NIVEL COMPLETADO!', {
        fontSize: '32px',
        fontStyle: 'bold',
        color: '#ffe66d'
    }).setOrigin(0.5);

    const btnBg = this.add.rectangle(0, 60, 200, 60, 0xff6b6b);
    btnBg.setInteractive({ useHandCursor: true });
    
    const btnText = this.add.text(0, 60, 'ACEPTAR', {
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#ffffff'
    }).setOrigin(0.5);

    btnBg.on('pointerover', () => btnBg.setFillStyle(0xff8787));
    btnBg.on('pointerout', () => btnBg.setFillStyle(0xff6b6b));
    
    btnBg.on('pointerdown', () => {
        this.scene.stop('UIScene');
        this.scene.start('MenuScene');
    });

    popup.add([bg, title, btnBg, btnText]);
    
    popup.setScale(0);
    this.tweens.add({
        targets: popup,
        scale: 1,
        duration: 300,
        ease: 'Back.out'
    });
  }

  private detachVisibilityHandlers() {
    if (!this.visibilityPersistHandler) return;
    document.removeEventListener('visibilitychange', this.visibilityPersistHandler);
    window.removeEventListener('beforeunload', this.visibilityPersistHandler);
    this.visibilityPersistHandler = undefined;
  }

  // --- Timer logic ---
  private startTimer() {
    this.lastBroadcastTime = 0;
    this.timerStore.start(this.currentLevelId, this.elapsedMs);
    this.broadcastTimer();
  }

  private stopTimer(persist: boolean = false) {
    this.timerStore.pause();
    if (persist) this.timerStore.persist(true);
  }

  update(time: number, delta: number) {
    this.timerStore.tick(delta);
    this.elapsedMs = this.timerStore.getElapsed();
    if (time - this.lastBroadcastTime >= 200) {
      this.broadcastTimer();
      this.lastBroadcastTime = time;
    }
  }

  private broadcastTimer() {
    this.events.emit('timer-updated', this.elapsedMs);
  }
}
