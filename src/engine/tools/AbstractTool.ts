import { PuzzleBoard } from '../board/PuzzleBoard';

export abstract class AbstractTool {
  protected isActive = false;

  constructor(
    protected scene: Phaser.Scene,
    protected board: PuzzleBoard,
  ) {}

  activate() {
    this.isActive = true;
    this.onActivate();
  }

  deactivate() {
    this.isActive = false;
    this.onDeactivate();
  }

  protected onActivate() {}
  protected onDeactivate() {}
  onPointerMove(_pointer: Phaser.Input.Pointer) {}
  confirm(_pointer: Phaser.Input.Pointer) {}
}
