export class PuzzleLayerStack {
  public readonly boardLayer: Phaser.GameObjects.Layer;
  public readonly solvedPiecesLayer: Phaser.GameObjects.Layer;
  public readonly activePiecesLayer: Phaser.GameObjects.Layer;

  public readonly solvedPieceDepth = 0;
  public readonly activePieceDepth = 1;
  public readonly draggingPieceDepth = 100;

  constructor(scene: Phaser.Scene) {
    this.boardLayer = scene.add.layer().setName('board_layer').setDepth(-10);
    this.solvedPiecesLayer = scene.add.layer().setName('solved_pieces_layer').setDepth(0);
    this.activePiecesLayer = scene.add.layer().setName('active_pieces_layer').setDepth(1);
  }

  addBoard(obj: Phaser.GameObjects.GameObject) {
    this.boardLayer.add(obj);
  }

  addToActive(obj: Phaser.GameObjects.GameObject) {
    this.solvedPiecesLayer.remove(obj);
    this.activePiecesLayer.add(obj);
    (obj as Phaser.GameObjects.Sprite).setDepth?.(this.activePieceDepth);
  }

  moveToSolved(obj: Phaser.GameObjects.GameObject) {
    this.activePiecesLayer.remove(obj);
    this.solvedPiecesLayer.add(obj);
    (obj as Phaser.GameObjects.Sprite).setDepth?.(this.solvedPieceDepth);
  }
}
