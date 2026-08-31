import type { PieceId } from '../../domain/pieceId';
import { PuzzleSession } from '../../domain/PuzzleSession';
import { AudioService } from '../audio/AudioService';
import { SelectionTool } from './SelectionTool';

export class HintTool extends SelectionTool {
  constructor(
    scene: Phaser.Scene,
    board: ConstructorParameters<typeof SelectionTool>[1],
    private session: PuzzleSession,
    private onSolvedVisual: (id: PieceId) => void,
  ) {
    super(scene, board, 1);
  }

  protected onActivate() {
    super.onActivate();
    this.scene.sys.canvas.style.cursor = 'help';
  }

  confirm(pointer: Phaser.Input.Pointer) {
    const sel = this.selectionAt(pointer);
    if (!sel) return;
    const id = this.session.queueHint(sel.startCol, sel.startRow);
    if (!id) return;
    const sprite = this.board.getSprite(id);
    const state = this.session.getPiece(id);
    if (!sprite || !state) return;
    AudioService.getInstance().playSnap();
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
        if (this.session.confirmHint(id)) {
          this.onSolvedVisual(id);
        }
      },
    });
  }
}
