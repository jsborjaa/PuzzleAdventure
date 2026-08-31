import type { PieceId } from '../../domain/pieceId';
import type { PieceState } from '../../domain/types';

export class PieceSprite extends Phaser.GameObjects.Sprite {
  readonly pieceId: PieceId;
  readonly correctX: number;
  readonly correctY: number;

  constructor(scene: Phaser.Scene, state: PieceState, textureKey: string, frameName: string) {
    super(scene, state.x, state.y, textureKey, frameName);
    this.pieceId = state.id;
    this.correctX = state.correctX;
    this.correctY = state.correctY;
    this.angle = state.angle;
    scene.add.existing(this);
  }
}
