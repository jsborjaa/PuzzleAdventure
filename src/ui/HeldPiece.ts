import type { PieceId } from '../domain/pieceId';
import { PuzzleSession } from '../domain/PuzzleSession';
import { PuzzleBoard } from '../engine/board/PuzzleBoard';
import { clientOverElement, clientToWorld } from '../engine/input/PieceInteraction';
import { drawPieceThumb } from './pieceThumb';

export class HeldPiece {
  private root: HTMLDivElement;
  private canvas: HTMLCanvasElement;
  private id: PieceId | null = null;

  constructor(
    private scene: Phaser.Scene,
    private board: PuzzleBoard,
    private session: PuzzleSession,
    private trayEl: HTMLElement,
  ) {
    this.root = document.createElement('div');
    this.root.className = 'piece-drag-ghost';
    this.root.hidden = true;
    this.canvas = document.createElement('canvas');
    this.canvas.width = 256;
    this.canvas.height = 256;
    this.root.appendChild(this.canvas);
    document.body.appendChild(this.root);
  }

  get activeId(): PieceId | null {
    return this.id;
  }

  start(id: PieceId, clientX: number, clientY: number) {
    this.id = id;
    const sprite = this.board.getSprite(id);
    const piece = this.session.getPiece(id);
    if (sprite && piece) drawPieceThumb(this.canvas, sprite, piece.angle);
    sprite?.setVisible(true).setAlpha(0);
    this.root.hidden = false;
    this.move(clientX, clientY);
  }

  move(clientX: number, clientY: number) {
    if (!this.id) return;
    const overTray = clientOverElement(this.trayEl, clientX, clientY);
    if (overTray) {
      const s = this.trayChipPx();
      this.root.style.width = `${s}px`;
      this.root.style.height = `${s}px`;
    } else {
      const s = this.boardChipPx(this.id);
      this.root.style.width = `${s}px`;
      this.root.style.height = `${s}px`;
    }
    this.root.style.left = `${clientX}px`;
    this.root.style.top = `${clientY}px`;
    const world = clientToWorld(this.scene, clientX, clientY);
    this.session.movePiece(this.id, world.x, world.y);
    this.board.getSprite(this.id)?.setPosition(world.x, world.y).setAlpha(0);
  }

  stop() {
    if (this.id) this.board.getSprite(this.id)?.setAlpha(1);
    this.id = null;
    this.root.hidden = true;
  }

  destroy() {
    this.stop();
    this.root.remove();
  }

  private trayChipPx() {
    const chip = this.trayEl.querySelector('.piece-chip:not(.is-dragging)') as HTMLElement | null;
    if (chip) {
      const r = chip.getBoundingClientRect();
      return Math.max(40, Math.min(r.width, r.height));
    }
    const r = this.trayEl.getBoundingClientRect();
    const landscape = document.getElementById('app')?.classList.contains('is-landscape');
    return Math.max(40, landscape ? r.width * 0.7 : r.height * 0.78);
  }

  private boardChipPx(id: PieceId) {
    const sprite = this.board.getSprite(id);
    const canvas = this.scene.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const zoom = this.scene.cameras.main.zoom;
    const sx = rect.width / Math.max(1, this.scene.scale.width);
    const world = sprite ? Math.max(sprite.displayWidth, sprite.displayHeight) : 80;
    return Math.max(48, world * zoom * sx);
  }
}
