import { AreaTool } from './AreaTool';
import { PuzzleBoard } from '../board/PuzzleBoard';

export class CameraTool extends AreaTool {
  private onCapture: (payload: {
    pieceLayout: Record<number, { gridRow: number; gridCol: number }>;
    imageKey: string;
    crop: { x: number; y: number; w: number; h: number };
    solvedIds: number[];
  }) => void;

  constructor(
    scene: Phaser.Scene,
    board: PuzzleBoard,
    gridSize: number,
    onCapture: (payload: {
      pieceLayout: Record<number, { gridRow: number; gridCol: number }>;
      imageKey: string;
      crop: { x: number; y: number; w: number; h: number };
      solvedIds: number[];
    }) => void
  ) {
    super(scene, board, gridSize);
    this.onCapture = onCapture;
  }

  protected confirmSelection(pointer: Phaser.Input.Pointer): void {
    const pieces = this.board.getPieces();
    if (pieces.length === 0) return;

    const pieceW = pieces[0].logicalWidth;
    const pieceH = pieces[0].logicalHeight;

    const container = this.board.getContainer();
    const boardX = container.x;
    const boardY = container.y;
    const worldPoint = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;

    const relX = worldPoint.x - boardX;
    const relY = worldPoint.y - boardY;

    // Hold-to-capture: si suelta fuera del tablero, cancelar sin capturar.
    // (Esto se ejecuta en pointerup; el highlight ya sigue al mouse vía SelectionTool.onPointerMove)
    const insideBoard =
      relX >= 0 &&
      relY >= 0 &&
      relX <= this.board.boardWidth &&
      relY <= this.board.boardHeight;
    if (!insideBoard) {
      this.scene.events.emit('pocket-camera-cancelled');
      return;
    }

    const centerCol = Math.floor(relX / pieceW);
    const centerRow = Math.floor(relY / pieceH);
    const rawStartCol = this.gridSize > 1 ? centerCol - Math.floor(this.gridSize / 2) : centerCol;
    const rawStartRow = this.gridSize > 1 ? centerRow - Math.floor(this.gridSize / 2) : centerRow;

    const maxCol = Math.max(...pieces.map((p) => p.gridCol));
    const maxRow = Math.max(...pieces.map((p) => p.gridRow));
    const maxStartCol = Math.max(0, maxCol - (this.gridSize - 1));
    const maxStartRow = Math.max(0, maxRow - (this.gridSize - 1));
    const startCol = Phaser.Math.Clamp(rawStartCol, 0, maxStartCol);
    const startRow = Phaser.Math.Clamp(rawStartRow, 0, maxStartRow);
    const endCol = startCol + this.gridSize - 1;
    const endRow = startRow + this.gridSize - 1;
    if (endCol < startCol || endRow < startRow) return;

    const selectedPieces = pieces.filter(
      (p) => p.gridCol >= startCol && p.gridCol <= endCol && p.gridRow >= startRow && p.gridRow <= endRow
    );
    if (selectedPieces.length === 0) return;

    const layout: Record<number, { gridRow: number; gridCol: number }> = {};
    const solvedIds: number[] = [];
    selectedPieces.forEach((p) => {
      const pieceId = pieces.indexOf(p);
      layout[pieceId] = { gridRow: p.gridRow, gridCol: p.gridCol };
      if (p.isSolved) solvedIds.push(pieceId);
    });
    const guide = this.board.getContainer().getByName('guide_image') as Phaser.GameObjects.Image;
    const imageKey = guide ? guide.texture.key : '';

    const boardCols = Math.max(...pieces.map((p) => p.gridCol)) + 1;
    const boardRows = Math.max(...pieces.map((p) => p.gridRow)) + 1;
    const boardW = boardCols * pieceW;
    const boardH = boardRows * pieceH;

    const cropX = Phaser.Math.Clamp(startCol * pieceW, 0, boardW);
    const cropY = Phaser.Math.Clamp(startRow * pieceH, 0, boardH);
    const cropW = Math.min(this.gridSize * pieceW, boardW - cropX);
    const cropH = Math.min(this.gridSize * pieceH, boardH - cropY);
    const crop = { x: cropX, y: cropY, w: cropW, h: cropH };
    this.onCapture({ pieceLayout: layout, imageKey, crop, solvedIds });
  }
}

