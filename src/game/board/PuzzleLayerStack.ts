import Phaser from 'phaser';

/**
 * Capas reales de Phaser vía `Layer` (no `Container`).
 *
 * Motivo: las piezas usan coordenadas en mundo (x/y absolutos) y el drag recibe coords en mundo.
 * `Container` cambia el sistema de coordenadas (relativo al container). `Layer` NO.
 */
export class PuzzleLayerStack {
  public readonly boardLayer: Phaser.GameObjects.Layer;
  public readonly solvedPiecesLayer: Phaser.GameObjects.Layer;
  public readonly activePiecesLayer: Phaser.GameObjects.Layer;
  public readonly overlayLayer: Phaser.GameObjects.Layer;

  // Depths de las layers (orden macro)
  public readonly boardLayerDepth = -10;
  public readonly solvedLayerDepth = 0;
  public readonly activeLayerDepth = 1;
  public readonly overlayLayerDepth = 2000;

  // Depths sugeridos dentro de cada layer
  public readonly solvedPieceDepth = 0;
  public readonly activePieceDepth = 1;
  public readonly draggingPieceDepth = 100;

  constructor(scene: Phaser.Scene) {
    this.boardLayer = scene.add.layer();
    this.boardLayer.setName('board_layer');
    this.boardLayer.setDepth(this.boardLayerDepth);

    this.solvedPiecesLayer = scene.add.layer();
    this.solvedPiecesLayer.setName('solved_pieces_layer');
    this.solvedPiecesLayer.setDepth(this.solvedLayerDepth);

    this.activePiecesLayer = scene.add.layer();
    this.activePiecesLayer.setName('active_pieces_layer');
    this.activePiecesLayer.setDepth(this.activeLayerDepth);

    this.overlayLayer = scene.add.layer();
    this.overlayLayer.setName('overlay_layer');
    this.overlayLayer.setDepth(this.overlayLayerDepth);
  }

  public addBoard(obj: Phaser.GameObjects.GameObject) {
    this.boardLayer.add(obj);
  }

  public addToActive(obj: Phaser.GameObjects.GameObject) {
    this.solvedPiecesLayer.remove(obj);
    this.overlayLayer.remove(obj);
    this.activePiecesLayer.add(obj);
    (obj as any).setDepth?.(this.activePieceDepth);
  }

  public addToSolved(obj: Phaser.GameObjects.GameObject) {
    this.activePiecesLayer.remove(obj);
    this.overlayLayer.remove(obj);
    this.solvedPiecesLayer.add(obj);
    (obj as any).setDepth?.(this.solvedPieceDepth);
  }

  public moveToSolved(obj: Phaser.GameObjects.GameObject) {
    this.addToSolved(obj);
  }

  public moveToActive(obj: Phaser.GameObjects.GameObject) {
    this.addToActive(obj);
  }

  public addToOverlay(obj: Phaser.GameObjects.GameObject) {
    this.activePiecesLayer.remove(obj);
    this.solvedPiecesLayer.remove(obj);
    this.overlayLayer.add(obj);
  }

  public removeFromOverlay(obj: Phaser.GameObjects.GameObject) {
    this.overlayLayer.remove(obj);
  }
}


