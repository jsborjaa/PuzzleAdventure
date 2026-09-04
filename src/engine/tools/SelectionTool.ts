import { clampSelection, worldToCell } from '../../domain/grid';
import { AbstractTool } from './AbstractTool';

const OVERLAY_DEPTH = 10000;

export class SelectionTool extends AbstractTool {
  protected graphics!: Phaser.GameObjects.Graphics;
  protected preview: Phaser.GameObjects.Image | null = null;

  constructor(
    scene: Phaser.Scene,
    board: ConstructorParameters<typeof AbstractTool>[1],
    protected gridSize: number,
  ) {
    super(scene, board);
    this.graphics = scene.add.graphics();
    this.graphics.setDepth(OVERLAY_DEPTH).setVisible(false);
  }

  private lingerTimer = 0;

  protected lingerHighlight(ms: number) {
    this.clearLinger();
    this.lingerTimer = window.setTimeout(() => {
      this.lingerTimer = 0;
      if (!this.graphics.scene) return;
      this.graphics.clear().setVisible(false);
      this.destroyPreview();
    }, ms);
  }

  private clearLinger() {
    if (this.lingerTimer) window.clearTimeout(this.lingerTimer);
    this.lingerTimer = 0;
  }

  protected onActivate() {
    this.clearLinger();
    this.graphics.setVisible(true);
    this.scene.sys.canvas.style.cursor = 'crosshair';
    this.updateGraphics(this.scene.input.activePointer);
  }

  protected onDeactivate() {
    this.scene.sys.canvas.style.cursor = 'default';
    if (this.lingerTimer) return;
    this.graphics.clear().setVisible(false);
    this.destroyPreview();
  }

  onPointerMove(pointer: Phaser.Input.Pointer) {
    this.updateGraphics(pointer);
  }

  protected selectionAt(pointer: Phaser.Input.Pointer) {
    const world = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    const board = this.board.bounds.board;
    const cell = worldToCell(
      world.x,
      world.y,
      board.x,
      board.y,
      board.width,
      board.height,
      this.board.layout.pieceWidth,
      this.board.layout.pieceHeight,
    );
    if (!cell) return null;
    return clampSelection(cell.col, cell.row, this.gridSize, this.board.layout.cols, this.board.layout.rows);
  }

  protected updateGraphics(pointer: Phaser.Input.Pointer) {
    this.graphics.clear();
    const sel = this.selectionAt(pointer);
    if (!sel) {
      this.preview?.setVisible(false);
      return;
    }
    const pw = this.board.layout.pieceWidth;
    const ph = this.board.layout.pieceHeight;
    const board = this.board.bounds.board;
    const drawX = board.x + sel.startCol * pw;
    const drawY = board.y + sel.startRow * ph;
    const width = pw * this.gridSize;
    const height = ph * this.gridSize;
    this.graphics.fillStyle(0xffff00, 0.28);
    this.graphics.lineStyle(3, 0xffff00, 0.95);
    this.graphics.fillRect(drawX, drawY, width, height);
    this.graphics.strokeRect(drawX, drawY, width, height);
    this.updatePreview(sel.startCol, sel.startRow, width, height);
  }

  private updatePreview(gridCol: number, gridRow: number, width: number, height: number) {
    if (!this.preview) {
      this.preview = this.scene.add.image(0, 0, this.board.imageKey);
      this.preview.setOrigin(0, 0).setAlpha(0.72).setDepth(OVERLAY_DEPTH + 1);
    }
    const board = this.board.bounds.board;
    this.preview.setPosition(board.x, board.y);
    this.preview.setCrop();
    this.preview.setCrop(
      gridCol * this.board.layout.pieceWidth,
      gridRow * this.board.layout.pieceHeight,
      width,
      height,
    );
    this.preview.setVisible(true);
  }

  protected destroyPreview() {
    this.preview?.destroy();
    this.preview = null;
  }
}
