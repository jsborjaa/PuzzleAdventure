import type { JigsawLayout } from '../../domain/jigsaw';
import type { PieceId } from '../../domain/pieceId';
import type { PieceState, ScatterBounds } from '../../domain/types';
import { PuzzleSession } from '../../domain/PuzzleSession';
import { atlasCacheKey, buildPieceAtlas, fingerprintImage, type BuiltAtlas } from '../pipeline/atlasBuilder';
import { getMemoryAtlas, loadCachedAtlas, persistAtlas, rememberAtlas } from '../pipeline/atlasCache';
import { PieceSprite } from './PieceSprite';
import { PuzzleLayerStack } from './PuzzleLayerStack';

export class PuzzleBoard {
  readonly bounds: ScatterBounds;
  readonly layout: JigsawLayout;
  readonly imageKey: string;
  boardWidth: number;
  boardHeight: number;

  private boardContainer: Phaser.GameObjects.Container;
  private layers: PuzzleLayerStack;
  private sprites = new Map<PieceId, PieceSprite>();
  private atlasKeys: string[] = [];
  private bgHint!: Phaser.GameObjects.Image;

  constructor(
    private scene: Phaser.Scene,
    layout: JigsawLayout,
    imageKey: string,
    bounds: ScatterBounds,
  ) {
    this.layout = layout;
    this.imageKey = imageKey;
    this.bounds = bounds;
    this.boardWidth = bounds.board.width;
    this.boardHeight = bounds.board.height;
    this.layers = new PuzzleLayerStack(scene);
    this.boardContainer = scene.add.container(bounds.board.x, bounds.board.y);
    this.layers.addBoard(this.boardContainer);
    this.setupBoardUi();
  }

  async createSprites(session: PuzzleSession): Promise<void> {
    const atlas = await this.ensureAtlas();
    this.registerAtlas(atlas);
    const frameToTexture = new Map<string, string>();
    atlas.frames.forEach((frame) => {
      frameToTexture.set(frame.id, this.atlasKeys[frame.atlasIndex]!);
    });

    for (const state of session.getPieces()) {
      const tex = frameToTexture.get(state.id);
      if (!tex) continue;
      const sprite = new PieceSprite(this.scene, state, tex, state.id);
      if (state.isSolved) this.layers.moveToSolved(sprite);
      else this.layers.addToActive(sprite);
      this.sprites.set(state.id, sprite);
    }
  }

  getSprite(id: PieceId) {
    return this.sprites.get(id);
  }

  getSprites() {
    return Array.from(this.sprites.values());
  }

  syncSprite(state: PieceState) {
    const sprite = this.sprites.get(state.id);
    if (!sprite) return;
    sprite.setPosition(state.x, state.y);
    sprite.setAngle(state.angle);
  }

  markSolved(id: PieceId) {
    const sprite = this.sprites.get(id);
    if (!sprite) return;
    sprite.disableInteractive();
    sprite.setPosition(sprite.correctX, sprite.correctY);
    sprite.setAngle(0);
    sprite.setScale(1);
    this.layers.moveToSolved(sprite);
  }

  setGuideAlpha(alpha: number) {
    this.bgHint.setAlpha(alpha);
  }

  getContainer() {
    return this.boardContainer;
  }

  destroy() {
    this.sprites.forEach((s) => s.destroy());
    this.sprites.clear();
    this.atlasKeys.forEach((key) => {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    });
  }

  private setupBoardUi() {
    this.bgHint = this.scene.add.image(0, 0, this.imageKey);
    this.bgHint.setAlpha(0).setOrigin(0, 0).setName('guide_image');
    this.boardContainer.add(this.bgHint);
    const border = this.scene.add.graphics();
    border.lineStyle(4, 0x666666, 0.8);
    border.strokeRect(0, 0, this.boardWidth, this.boardHeight);
    this.boardContainer.add(border);
  }

  private async ensureAtlas(): Promise<BuiltAtlas> {
    const source = this.scene.textures.get(this.imageKey).getSourceImage() as HTMLImageElement;
    const fingerprint = fingerprintImage(source, this.layout.imageWidth, this.layout.imageHeight);
    const key = atlasCacheKey(this.layout, this.imageKey, fingerprint);
    const cached = getMemoryAtlas(key) ?? (await loadCachedAtlas(key));
    if (cached) return cached;
    const atlas = buildPieceAtlas(source, this.layout, this.imageKey, fingerprint);
    rememberAtlas(atlas);
    persistAtlas(atlas);
    return atlas;
  }

  private registerAtlas(atlas: BuiltAtlas) {
    this.atlasKeys = atlas.canvases.map((_, i) => `atlas_${atlas.cacheKey}_${i}`);
    atlas.canvases.forEach((canvas, i) => {
      const key = this.atlasKeys[i]!;
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
      const tex = this.scene.textures.addCanvas(key, canvas);
      if (!tex) return;
      atlas.frames
        .filter((f) => f.atlasIndex === i)
        .forEach((frame) => {
          tex.add(frame.id, 0, frame.x, frame.y, frame.w, frame.h);
        });
    });
  }
}
