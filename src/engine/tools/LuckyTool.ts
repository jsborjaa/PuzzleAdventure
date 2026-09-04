import type { PieceId } from '../../domain/pieceId';
import { PuzzleSession } from '../../domain/PuzzleSession';
import { AudioService } from '../audio/AudioService';
import { PuzzleBoard } from '../board/PuzzleBoard';
import { AbstractTool } from './AbstractTool';

export class LuckyTool extends AbstractTool {
  constructor(
    scene: Phaser.Scene,
    board: PuzzleBoard,
    private session: PuzzleSession,
    private onSolvedVisual: (id: PieceId) => void,
  ) {
    super(scene, board);
  }

  protected onActivate() {
    this.scene.sys.canvas.style.cursor = 'help';
  }

  confirm(pointer: Phaser.Input.Pointer) {
    if (!this.overBoard(pointer)) return;
    const id = this.session.queueLucky();
    if (!id) return;
    const sprite = this.board.getSprite(id);
    const state = this.session.getPiece(id);
    if (!sprite || !state) return;
    AudioService.getInstance().playSnap();
    if (state.inTray) {
      const world = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
      this.session.movePiece(id, world.x, world.y);
    }
    sprite.setVisible(true);
    sprite.setDepth(1000);
    sprite.disableInteractive();
    this.scene.tweens.add({
      targets: sprite,
      x: state.correctX,
      y: state.correctY,
      angle: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => {
        if (this.session.confirmLucky(id)) {
          this.onSolvedVisual(id);
        }
      },
    });
  }

  private overBoard(pointer: Phaser.Input.Pointer) {
    const world = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    const board = this.board.bounds.board;
    return (
      world.x >= board.x &&
      world.x <= board.x + board.width &&
      world.y >= board.y &&
      world.y <= board.y + board.height
    );
  }
}
