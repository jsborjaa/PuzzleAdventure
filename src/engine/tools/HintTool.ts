import type { PieceId } from '../../domain/pieceId';
import { PuzzleSession } from '../../domain/PuzzleSession';
import { AudioService } from '../audio/AudioService';
import { flyPieceHome } from './flyPieceHome';
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
    const world = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    AudioService.getInstance().playSnap();
    flyPieceHome(this.scene, this.board, this.session, id, 1000, (pieceId) => {
      if (this.session.confirmHint(pieceId)) this.onSolvedVisual(pieceId);
    }, world);
  }
}
