import {
  CAMERA_BOUNDS_PADDING,
  CAMERA_FIT_VIEW_PAD,
  CAMERA_FIT_ZOOM_MAX,
  CAMERA_FIT_ZOOM_MIN,
  type ToolId,
} from '../domain/product';
import type { ScatterBounds } from '../domain/types';
import { buildJigsawLayout } from '../domain/jigsaw';
import { applyQualityGate } from '../domain/quality';
import { makeScatterBounds, PuzzleSession } from '../domain/PuzzleSession';
import { LevelCatalog } from '../data/LevelCatalog';
import { ProgressStore } from '../data/ProgressStore';
import { GameHud } from '../ui/GameHud';
import { AudioService } from './audio/AudioService';
import { PuzzleBoard } from './board/PuzzleBoard';
import { CameraController } from './input/CameraController';
import { attachPieceInteraction } from './input/PieceInteraction';
import { loadLevelTexture } from './loadLevelTexture';
import { AreaTool } from './tools/AreaTool';
import { HintTool } from './tools/HintTool';
import { ToolManager } from './tools/ToolManager';

export class GameRuntime {
  private session!: PuzzleSession;
  private board!: PuzzleBoard;
  private tools!: ToolManager;
  private camera!: CameraController;
  private hud!: GameHud;
  private scatterBounds?: ScatterBounds;
  private unsub: () => void = () => {};
  private persistHandler?: () => void;
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
    const saved = special ? store.getSpecialSession(level.id) : store.getSession();
    const completed = store.getBestMs(level.id) !== null || (!special && store.isLevelCompleted(level.id));
    const inProgress = !!saved && saved.levelId === level.id && saved.pieces.some((p) => !p.isSolved);
    let mode: 'fresh' | 'resume' | 'replay' = 'fresh';
    if (inProgress && !this.data.forceReplay) mode = 'resume';
    else if (completed && !this.data.forceReplay) mode = 'replay';

    this.session = new PuzzleSession({
      level,
      layout,
      bounds,
      mode,
      saved: mode === 'resume' ? saved : null,
      special,
      store,
      qualityReduced: gated.reduced ? { from: requested, to: gated.count } : undefined,
    });

    this.board = new PuzzleBoard(this.scene, layout, level.imageKey, bounds);
    await this.board.createSprites(this.session);
    if (this.destroyed) {
      this.board.destroy();
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

    for (const sprite of this.board.getSprites()) {
      const state = this.session.getPiece(sprite.pieceId);
      if (!state || state.isSolved) continue;
      attachPieceInteraction(sprite, this.session, (id) => this.board.markSolved(id));
    }

    const ui = document.getElementById('ui-layer')!;
    this.hud = new GameHud(ui, this.session, {
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
        else store.clearSession();
        this.scene.scene.restart({ levelId: level.id, forceReplay: true });
      },
    });

    this.unsub = this.session.on((event) => {
      if (event.type === 'revealChanged') this.board.setGuideAlpha(this.session.guideAlpha);
      if (event.type === 'won') {
        AudioService.getInstance().playWin();
      }
      if (event.type === 'pieceMoved' || event.type === 'pieceRotated') {
        const state = this.session.getPiece(event.id);
        if (state) this.board.syncSprite(state);
      }
    });

    this.persistHandler = () => this.session.save();
    document.addEventListener('visibilitychange', this.persistHandler);
    window.addEventListener('beforeunload', this.persistHandler);
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
    this.hud?.destroy();
    this.tools?.destroy();
    this.camera?.destroy();
    this.board?.destroy();
    if (this.persistHandler) {
      document.removeEventListener('visibilitychange', this.persistHandler);
      window.removeEventListener('beforeunload', this.persistHandler);
    }
  }

  private exitToMenu() {
    this.session?.save();
    this.scene.scene.start('MenuScene');
  }

  private onScaleResize() {
    if (this.destroyed || !this.scatterBounds) return;
    this.fitCamera(this.scatterBounds);
  }

  private fitCamera(bounds: ScatterBounds) {
    const { world, board } = bounds;
    const cam = this.scene.cameras.main;
    cam.setBounds(
      world.x - CAMERA_BOUNDS_PADDING,
      world.y - CAMERA_BOUNDS_PADDING,
      world.width + CAMERA_BOUNDS_PADDING * 2,
      world.height + CAMERA_BOUNDS_PADDING * 2,
    );
    cam.centerOn(board.x + board.width / 2, board.y + board.height / 2);
    const fitW = world.width + CAMERA_FIT_VIEW_PAD * 2;
    const fitH = world.height + CAMERA_FIT_VIEW_PAD * 2;
    const zoom = Phaser.Math.Clamp(
      Math.min(this.scene.scale.width / fitW, this.scene.scale.height / fitH),
      CAMERA_FIT_ZOOM_MIN,
      CAMERA_FIT_ZOOM_MAX,
    );
    cam.setZoom(zoom);
  }
}
