import {
  CAMERA_BOUNDS_PADDING,
  CAMERA_FIT_VIEW_PAD,
  CAMERA_FIT_ZOOM_MAX,
  CAMERA_FIT_ZOOM_MIN,
  type ToolId,
} from '../domain/product';
import type { PieceId } from '../domain/pieceId';
import type { ScatterBounds } from '../domain/types';
import { buildJigsawLayout } from '../domain/jigsaw';
import { applyQualityGate } from '../domain/quality';
import { makeScatterBounds, PuzzleSession } from '../domain/PuzzleSession';
import { LevelCatalog } from '../data/LevelCatalog';
import { ProgressStore } from '../data/ProgressStore';
import { pushBackHandler } from '../app/backButton';
import { GameHud } from '../ui/GameHud';
import { HeldPiece } from '../ui/HeldPiece';
import { mountPlayShell, type PlayShell } from '../ui/PlayShell';
import { PieceTray } from '../ui/PieceTray';
import { AudioService } from './audio/AudioService';
import { PuzzleBoard } from './board/PuzzleBoard';
import { CameraController } from './input/CameraController';
import { attachPieceInteraction, clientOverElement } from './input/PieceInteraction';
import { loadLevelTexture } from './loadLevelTexture';
import { AreaTool } from './tools/AreaTool';
import { HintTool } from './tools/HintTool';
import { LuckyTool } from './tools/LuckyTool';
import { RevealTool } from './tools/RevealTool';
import { SolverTool } from './tools/SolverTool';
import { ToolManager } from './tools/ToolManager';

export class GameRuntime {
  private session!: PuzzleSession;
  private board!: PuzzleBoard;
  private tools!: ToolManager;
  private camera!: CameraController;
  private hud!: GameHud;
  private tray?: PieceTray;
  private held?: HeldPiece;
  private shell?: PlayShell;
  private scatterBounds?: ScatterBounds;
  private unsub: () => void = () => {};
  private persistHandler?: () => void;
  private unback: () => void = () => {};
  private destroyed = false;
  constructor(
    private scene: Phaser.Scene,
    private data: { levelId: string; forceReplay?: boolean },
  ) {}

  async start() {
    const catalog = LevelCatalog.getInstance();
    await catalog.ensureLoaded();
    const level = catalog.getById(this.data.levelId);
    if (!level) {
      this.scene.scene.start('MenuScene');
      return;
    }

    const store = ProgressStore.getInstance();
    store.setLastPlayedLevelId(level.id);

    const loaded = await loadLevelTexture(this.scene, level);
    if (this.destroyed) return;
    const texture = this.scene.textures.get(level.imageKey);
    if (!loaded || !this.scene.textures.exists(level.imageKey) || texture.key === '__MISSING') {
      console.error('Level image missing', level.imageKey);
      this.scene.scene.start('MenuScene');
      return;
    }
    const img = texture.getSourceImage() as HTMLImageElement;
    const requested = level.difficulty;
    const gated = applyQualityGate(requested);
    const layout = buildJigsawLayout(level.id, img.width, img.height, gated.count);
    const bounds = makeScatterBounds(img.width, img.height);
    const special = !!level.eventType;
    const savedRaw = special ? store.getSpecialSession(level.id) : store.getSession();
    const layoutMismatch =
      !!savedRaw && savedRaw.levelId === level.id && savedRaw.pieces.length !== layout.pieces.length;
    if (layoutMismatch) {
      if (special) store.clearSpecialSession(level.id);
      else store.clearCampaignSessionIf(level.id);
    }
    const saved = layoutMismatch ? null : savedRaw;
    const completed = store.getBestMs(level.id) !== null || (!special && store.isLevelCompleted(level.id));
    const inProgress = !!saved && saved.levelId === level.id && saved.pieces.some((p) => !p.isSolved);
    let mode: 'fresh' | 'resume' | 'replay' = 'fresh';
    if (inProgress && !this.data.forceReplay) mode = 'resume';
    else if (completed && !this.data.forceReplay) mode = 'replay';
    const skipCampaignSave =
      !special &&
      !!saved &&
      saved.levelId !== level.id &&
      (!!this.data.forceReplay || (completed && !inProgress));

    this.session = new PuzzleSession({
      level,
      layout,
      bounds,
      mode,
      saved: mode === 'resume' ? saved : null,
      special,
      store,
      qualityReduced: gated.reduced ? { from: requested, to: gated.count } : undefined,
      skipCampaignSave,
    });

    this.shell = mountPlayShell();
    window.dispatchEvent(new Event('resize'));

    this.board = new PuzzleBoard(this.scene, layout, level.imageKey, bounds);
    await this.board.createSprites(this.session);
    if (this.destroyed) {
      this.board.destroy();
      this.shell.destroy();
      return;
    }
    this.scatterBounds = bounds;
    this.fitCamera(bounds);
    this.scene.scale.on('resize', this.onScaleResize, this);
    this.board.setGuideAlpha(this.session.guideAlpha);

    this.camera = new CameraController(this.scene);
    this.tools = new ToolManager(this.scene);
    this.tools.addTool('area', new AreaTool(this.scene, this.board, 3, this.session));
    this.tools.addTool('sarea', new AreaTool(this.scene, this.board, 4, this.session));
    this.tools.addTool('hint', new HintTool(this.scene, this.board, this.session, (id) => this.board.markSolved(id)));
    this.tools.addTool('lucky', new LuckyTool(this.scene, this.board, this.session, (id) => this.board.markSolved(id)));
    this.tools.addTool('solver', new SolverTool(this.scene, this.board, this.session, (id) => this.board.markSolved(id)));
    this.tools.addTool('reveal_temp', new RevealTool(this.scene, this.board, this.session, 'reveal_temp'));
    this.tools.addTool('reveal_perm', new RevealTool(this.scene, this.board, this.session, 'reveal_perm'));

    const trayHit = {
      isOverTray: (clientX: number, clientY: number) => clientOverElement(this.shell!.tray, clientX, clientY),
      insertIndex: (clientX: number, clientY: number, id: PieceId) => this.tray?.insertIndexAt(clientX, clientY, id) ?? 0,
      onReturnToTray: (id: PieceId) => {
        this.applyPieceVisual(id);
        requestAnimationFrame(() => this.tray?.revealChip(id));
      },
    };

    this.held = new HeldPiece(this.scene, this.board, this.session, this.shell.tray);

    for (const sprite of this.board.getSprites()) {
      const state = this.session.getPiece(sprite.pieceId);
      if (!state || state.isSolved) continue;
      attachPieceInteraction(sprite, this.session, (id) => this.board.markSolved(id), {
        ...trayHit,
        setCameraEnabled: (on) => this.camera.setEnabled(on),
        onHoldStart: (id, x, y) => this.held?.start(id, x, y),
        onHoldMove: (x, y) => {
          this.held?.move(x, y);
          if (clientOverElement(this.shell!.tray, x, y)) {
            this.tray?.previewInsert(this.tray.insertIndexAt(x, y, this.held?.activeId), this.held?.activeId);
          } else {
            this.tray?.clearPreview();
          }
        },
        onHoldEnd: () => {
          this.held?.stop();
          this.tray?.clearPreview();
        },
      });
      sprite.setData('pa-interact', true);
      this.applyPieceVisual(sprite.pieceId);
    }

    const ui = document.getElementById('ui-layer')!;
    this.hud = new GameHud(ui, this.shell.chrome, this.shell.status, this.session, {
      onExitToMenu: () => this.exitToMenu(),
      onActivateTool: (tool: ToolId) => {
        this.camera.setEnabled(false);
        this.tools.activate(tool);
      },
      onDeactivateTool: (pageX, pageY) => {
        this.tools.confirmAt(pageX, pageY);
        this.camera.setEnabled(true);
      },
      onReplay: () => {
        if (special) store.clearSpecialSession(level.id);
        else store.clearCampaignSessionIf(level.id);
        this.scene.scene.restart({ levelId: level.id, forceReplay: true });
      },
    });

    this.unback = pushBackHandler(() => {
      if (this.hud.handleBack()) return true;
      this.exitToMenu();
      return true;
    });

    this.tray = new PieceTray(this.shell.tray, this.session, this.board, {
      setCameraEnabled: (on) => this.camera.setEnabled(on),
      isOverTray: trayHit.isOverTray,
      applyPieceVisual: (id) => this.applyPieceVisual(id),
      onSolvedVisual: (id) => this.board.markSolved(id),
      held: this.held,
    });

    this.unsub = this.session.on((event) => {
      if (event.type === 'revealChanged') this.board.setGuideAlpha(this.session.guideAlpha);
      if (event.type === 'won') {
        AudioService.getInstance().playWin();
      }
      if (event.type === 'pieceMoved' || event.type === 'pieceRotated') {
        if (this.held?.activeId === event.id) return;
        const state = this.session.getPiece(event.id);
        if (state && !state.inTray) this.board.syncSprite(state);
      }
      if (event.type === 'pieceTrayChanged') {
        if (this.held?.activeId === event.id) return;
        this.applyPieceVisual(event.id);
      }
    });

    this.persistHandler = () => this.session.save();
    document.addEventListener('visibilitychange', this.persistHandler);
    window.addEventListener('beforeunload', this.persistHandler);

    requestAnimationFrame(() => {
      window.dispatchEvent(new Event('resize'));
      if (this.scatterBounds) this.fitCamera(this.scatterBounds);
    });
  }

  update(time: number, delta: number) {
    void time;
    if (!this.session || this.destroyed) return;
    this.session.tick(delta);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.session?.save();
    this.scene.scale.off('resize', this.onScaleResize, this);
    this.unsub();
    this.unback();
    this.tray?.destroy();
    this.held?.destroy();
    this.hud?.destroy();
    this.tools?.destroy();
    this.camera?.destroy();
    this.board?.destroy();
    this.shell?.destroy();
    window.dispatchEvent(new Event('resize'));
    if (this.persistHandler) {
      document.removeEventListener('visibilitychange', this.persistHandler);
      window.removeEventListener('beforeunload', this.persistHandler);
    }
  }

  private applyPieceVisual(id: PieceId) {
    const state = this.session.getPiece(id);
    const sprite = this.board.getSprite(id);
    if (!state || !sprite) return;
    if (state.isSolved) {
      sprite.setVisible(true);
      sprite.setAlpha(1);
      sprite.disableInteractive();
      return;
    }
    if (state.inTray) {
      sprite.setVisible(false);
      sprite.setAlpha(1);
      sprite.disableInteractive();
      return;
    }
    sprite.setVisible(true);
    sprite.setAlpha(1);
    sprite.setPosition(state.x, state.y);
    sprite.setAngle(state.angle);
    if (!sprite.input?.enabled) {
      sprite.setInteractive({ draggable: true, useHandCursor: true });
    }
  }

  private exitToMenu() {
    this.session?.save();
    this.scene.scene.start('MenuScene');
  }

  private onScaleResize(gameSize?: Phaser.Structs.Size) {
    if (this.destroyed || !this.scatterBounds) return;
    const width = Math.round(gameSize?.width ?? this.scene.scale.width);
    const height = Math.round(gameSize?.height ?? this.scene.scale.height);
    if (width < 2 || height < 2) return;
    this.scene.cameras.main.setSize(width, height);
    this.fitCamera(this.scatterBounds);
  }

  private fitCamera(bounds: ScatterBounds) {
    const { world, board } = bounds;
    const cam = this.scene.cameras.main;
    const viewW = Math.max(1, cam.width || this.scene.scale.width);
    const viewH = Math.max(1, cam.height || this.scene.scale.height);
    cam.setBounds(
      world.x - CAMERA_BOUNDS_PADDING,
      world.y - CAMERA_BOUNDS_PADDING,
      world.width + CAMERA_BOUNDS_PADDING * 2,
      world.height + CAMERA_BOUNDS_PADDING * 2,
    );
    cam.centerOn(board.x + board.width / 2, board.y + board.height / 2);
    const fitW = board.width + CAMERA_FIT_VIEW_PAD * 2;
    const fitH = board.height + CAMERA_FIT_VIEW_PAD * 2;
    const zoom = Phaser.Math.Clamp(
      Math.min(viewW / fitW, viewH / fitH),
      CAMERA_FIT_ZOOM_MIN,
      CAMERA_FIT_ZOOM_MAX,
    );
    cam.setZoom(zoom);
  }
}
