import { Scene } from 'phaser';
import { PuzzlePieceConfig } from '../services/ImageSplitter';

export class Piece extends Phaser.GameObjects.Sprite {
  public correctX: number;
  public correctY: number;
  public isSolved: boolean = false;
  public isEdge: boolean = false;
  public gridRow: number = -1;
  public gridCol: number = -1;
  public logicalWidth: number;
  public logicalHeight: number;

  constructor(scene: Scene, config: PuzzlePieceConfig) {
    super(scene, config.x, config.y, config.textureKey);
    
    this.correctX = config.x;
    this.correctY = config.y;
    this.gridRow = config.row; // Store grid position
    this.gridCol = config.col; // Store grid position
    this.logicalWidth = config.width;
    this.logicalHeight = config.height;

    // Initial random position (scattered)
    // We will set this from the scene to keep it organized, or here.
    // The scene will scatter them.

    scene.add.existing(this);
    this.setDepth(1); // Start above background
  }
}

