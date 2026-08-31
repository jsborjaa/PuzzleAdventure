import { PuzzleSession } from '../../domain/PuzzleSession';
import { AudioService } from '../audio/AudioService';
import { SelectionTool } from './SelectionTool';

export class AreaTool extends SelectionTool {
  constructor(
    scene: Phaser.Scene,
    board: ConstructorParameters<typeof SelectionTool>[1],
    gridSize: number,
    private session: PuzzleSession,
  ) {
    super(scene, board, gridSize);
  }

  confirm(pointer: Phaser.Input.Pointer) {
    const sel = this.selectionAt(pointer);
    if (!sel) return;
    const ids = this.session.useArea(sel.startCol, sel.startRow, this.gridSize);
    if (ids.length === 0) return;
    AudioService.getInstance().playPop();
    for (const id of ids) {
      const state = this.session.getPiece(id);
      const sprite = this.board.getSprite(id);
      if (!state || !sprite) continue;
      sprite.setDepth(100);
      this.scene.tweens.add({
        targets: sprite,
        x: state.x,
        y: state.y,
        duration: 500,
        ease: 'Cubic.out',
        onComplete: () => sprite.setDepth(1),
      });
    }
  }
}
