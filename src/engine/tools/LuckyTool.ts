import type { PieceId } from '../../domain/pieceId';
import { PuzzleSession } from '../../domain/PuzzleSession';
import { AudioService } from '../audio/AudioService';
import { PuzzleBoard } from '../board/PuzzleBoard';
import { clientToWorld } from '../input/PieceInteraction';
import type { PieceTray } from '../../ui/PieceTray';
import { AbstractTool } from './AbstractTool';
import { flyPieceHome } from './flyPieceHome';

export class LuckyTool extends AbstractTool {
  private lastPage = { x: 0, y: 0 };
  private highlighted: Phaser.GameObjects.Sprite | null = null;

  constructor(
    scene: Phaser.Scene,
    board: PuzzleBoard,
    private session: PuzzleSession,
    private onSolvedVisual: (id: PieceId) => void,
    private getTray: () => PieceTray | undefined,
  ) {
    super(scene, board);
  }

  protected onActivate() {
    this.scene.sys.canvas.style.cursor = 'help';
  }

  protected onDeactivate() {
    this.clearHighlight();
    this.scene.sys.canvas.style.cursor = 'default';
  }

  onPointerMove(_pointer: Phaser.Input.Pointer, pageX?: number, pageY?: number) {
    if (pageX != null && pageY != null) this.lastPage = { x: pageX, y: pageY };
    this.highlight(this.targetAt(this.lastPage.x, this.lastPage.y));
  }

  confirm(_pointer: Phaser.Input.Pointer, pageX?: number, pageY?: number) {
    const page = {
      x: pageX ?? this.lastPage.x,
      y: pageY ?? this.lastPage.y,
    };
    this.clearHighlight();
    const id = this.targetAt(page.x, page.y);
    if (!id) return;
    if (!this.session.queueLucky(id)) return;
    const clientX = page.x - window.scrollX;
    const clientY = page.y - window.scrollY;
    const world = clientToWorld(this.scene, clientX, clientY);
    AudioService.getInstance().playSnap();
    flyPieceHome(this.scene, this.board, this.session, id, 1000, (pieceId) => {
      if (this.session.confirmLucky(pieceId)) this.onSolvedVisual(pieceId);
    }, world);
  }

  private targetAt(pageX: number, pageY: number): PieceId | null {
    const clientX = pageX - window.scrollX;
    const clientY = pageY - window.scrollY;
    const trayId = this.getTray()?.pieceIdAt(clientX, clientY);
    if (trayId) {
      const piece = this.session.getPiece(trayId);
      if (piece && !piece.isSolved) return trayId;
    }
    const world = clientToWorld(this.scene, clientX, clientY);
    let best: { id: PieceId; d: number } | null = null;
    for (const sprite of this.board.getSprites()) {
      const state = this.session.getPiece(sprite.pieceId);
      if (!state || state.isSolved || state.inTray || !sprite.visible) continue;
      const hw = sprite.displayWidth / 2;
      const hh = sprite.displayHeight / 2;
      if (world.x < sprite.x - hw || world.x > sprite.x + hw || world.y < sprite.y - hh || world.y > sprite.y + hh) {
        continue;
      }
      const d = Math.hypot(world.x - sprite.x, world.y - sprite.y);
      if (!best || d < best.d) best = { id: sprite.pieceId, d };
    }
    return best?.id ?? null;
  }

  private highlight(id: PieceId | null) {
    this.getTray()?.setToolTarget(id);
    const next = id ? this.board.getSprite(id) : null;
    if (this.highlighted && this.highlighted !== next) {
      this.highlighted.clearTint();
      this.highlighted = null;
    }
    if (next && !this.session.getPiece(id!)?.inTray) {
      next.setTint(0xffe27a);
      this.highlighted = next;
    } else if (this.highlighted) {
      this.highlighted.clearTint();
      this.highlighted = null;
    }
  }

  private clearHighlight() {
    this.getTray()?.setToolTarget(null);
    this.highlighted?.clearTint();
    this.highlighted = null;
  }
}
