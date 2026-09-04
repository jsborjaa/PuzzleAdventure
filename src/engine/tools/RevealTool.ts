import { REVEAL_PERM_ALPHA, REVEAL_TEMP_ALPHA, type PowerupKey } from '../../domain/product';
import { PuzzleSession } from '../../domain/PuzzleSession';
import { AudioService } from '../audio/AudioService';
import { PuzzleBoard } from '../board/PuzzleBoard';
import { AbstractTool } from './AbstractTool';

export class RevealTool extends AbstractTool {
  constructor(
    scene: Phaser.Scene,
    board: PuzzleBoard,
    private session: PuzzleSession,
    private kind: Extract<PowerupKey, 'reveal_temp' | 'reveal_perm'>,
  ) {
    super(scene, board);
  }

  protected onActivate() {
    this.scene.sys.canvas.style.cursor = 'copy';
    this.preview(this.scene.input.activePointer);
  }

  protected onDeactivate() {
    this.board.setGuideAlpha(this.session.guideAlpha);
    this.scene.sys.canvas.style.cursor = 'default';
  }

  onPointerMove(pointer: Phaser.Input.Pointer) {
    this.preview(pointer);
  }

  confirm(pointer: Phaser.Input.Pointer) {
    if (!this.overBoard(pointer)) return;
    const ok =
      this.kind === 'reveal_perm'
        ? this.session.activatePermanentReveal()
        : this.session.activateTemporaryReveal();
    if (ok) AudioService.getInstance().playPop();
    this.board.setGuideAlpha(this.session.guideAlpha);
  }

  private preview(pointer: Phaser.Input.Pointer) {
    if (!this.overBoard(pointer) || this.session.getReveal().permanent) {
      this.board.setGuideAlpha(this.session.guideAlpha);
      return;
    }
    this.board.setGuideAlpha(this.kind === 'reveal_perm' ? REVEAL_PERM_ALPHA : REVEAL_TEMP_ALPHA);
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
