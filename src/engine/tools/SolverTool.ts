import type { PieceId } from '../../domain/pieceId';
import { PuzzleSession } from '../../domain/PuzzleSession';
import { AudioService } from '../audio/AudioService';
import { flyPieceHome } from './flyPieceHome';
import { SelectionTool } from './SelectionTool';

export class SolverTool extends SelectionTool {
  constructor(
    scene: Phaser.Scene,
    board: ConstructorParameters<typeof SelectionTool>[1],
    private session: PuzzleSession,
    private onSolvedVisual: (id: PieceId) => void,
  ) {
    super(scene, board, 3);
  }

  confirm(pointer: Phaser.Input.Pointer) {
    const sel = this.selectionAt(pointer);
    if (!sel) return;
    const ids = this.session.queueSolver(sel.startCol, sel.startRow, this.gridSize);
    if (ids.length === 0) return;
    this.lingerHighlight(700);
    AudioService.getInstance().playSnap();
    const world = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    for (const id of ids) {
      flyPieceHome(this.scene, this.board, this.session, id, 600, (pieceId) => {
        if (this.session.confirmSolver(pieceId)) this.onSolvedVisual(pieceId);
      }, world);
    }
  }
}
